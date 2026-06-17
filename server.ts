import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dns from "dns";
import { generateLrcFromAudio, generateLrcFromText, fetchLyricsFromGemini } from "./server/lrcEngine";
import { searchYouTubeOnServer } from "./server/youtubeSearch";

// Set default DNS resolution to ipv4 first to avoid slow localhost resolving issues
dns.setDefaultResultOrder("ipv4first");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Sliding-window in-memory rate limiter (15 requests per minute per IP for AI requests)
  const ipLimits = new Map<string, { count: number; resetTime: number }>();
  
  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.ip || req.headers['x-forwarded-for'] || 'unknown') as string;
    const now = Date.now();
    const limit = ipLimits.get(ip);

    if (!limit || now > limit.resetTime) {
      ipLimits.set(ip, {
        count: 1,
        resetTime: now + 60 * 1000
      });
      return next();
    }

    if (limit.count >= 15) {
      console.warn(`[RateLimit] Blocked request from IP: ${ip}`);
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Limit is 15 per minute. / لقد تجاوزت حد الطلبات المسموح به (15 طلب في الدقيقة).'
      });
    }

    limit.count++;
    next();
  };

  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ limit: "20mb", extended: true }));

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Endpoints for listen2song API

  // 1. Plain Lyrics Search Endpoint (via OpenRouter or standard fallback)
  app.get("/api/lyrics", rateLimiter, async (req: express.Request, res: express.Response) => {
    const songParam = req.query.song;
    const artistParam = req.query.artist;

    if (!songParam) {
      return res.status(400).json({ 
         success: false, 
         error: 'Song name is required / اسم الأغنية مطلوب' 
      });
    }

    const sanitize = (val: any): string => {
      if (typeof val !== 'string') return '';
      return val.trim().slice(0, 100).replace(/<[^>]*>/g, '');
    };

    const song = sanitize(songParam);
    const artist = sanitize(artistParam);
    const apiKey = process.env.OPENROUTER_API_KEY;

    let lyricsText: string | null = null;

    // Phase 1: Try OpenRouter if API key is present
    if (apiKey) {
      try {
        const query = artist ? `"${song}" by ${artist}` : `"${song}"`;
        console.log(`[PlainLyricsRequest] Requesting plain lyrics with OpenRouter for: ${query}`);

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://listen2song.ai",
            "X-Title": "listen2song Music Player"
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
            messages: [
              {
                role: "system",
                content: "You are an expert music lyricist. Your task is to output the clean, complete plain text lyrics of the requested song. Do NOT output any conversational text, notes, links, brackets like [Verse] or [Chorus] if possible, or explanations. Keep the layout simple with one line per verse row. Translate or preserve non-English titles accordingly."
              },
              {
                role: "user",
                content: `Output the original clean lyrics for: ${query}`
              }
            ],
            temperature: 0.3,
            max_tokens: 1548,
            seed: 42
          })
        });

        if (response.ok) {
          const responseData: any = await response.json();
          const parsedContent = responseData.choices?.[0]?.message?.content;
          if (parsedContent && parsedContent.trim().length > 10) {
            lyricsText = parsedContent.trim();
          }
        } else {
          console.warn(`OpenRouter plain lyrics request failed with status: ${response.status}. trying Gemini fallback...`);
        }
      } catch (err: any) {
        console.warn(`[PlainLyricsRequest] OpenRouter query error: ${err.message || err}. trying Gemini fallback...`);
      }
    }

    // Phase 2: Cascading to Gemini 3.5 if OpenRouter is unconfigured, failed, or rate-limited
    if (!lyricsText) {
      try {
        console.log(`[PlainLyricsRequest] Requesting plain lyrics via Gemini 3.5 fallback for: "${song}"`);
        lyricsText = await fetchLyricsFromGemini(song, artist);
      } catch (geminiErr: any) {
        console.error(`[PlainLyricsRequest] Gemini fallback failed:`, geminiErr.message || geminiErr);
      }
    }

    // Phase 3: Ultimate Graceful Fallback (rather than returning 500 error to user)
    if (!lyricsText || lyricsText.trim().length < 10) {
      const fallbackLyrics = `[00:00] Playing: ${song} ${artist ? 'by ' + artist : ''}
[00:05] (Lyrics temporarily unavailable / الكلمات غير متوفرة مؤقتاً)
[00:10] Try using the "Synchronize LRC / مزامنة الكلمات" panel below or manually paste plain text lyrics!
[00:15] Enjoy listening on Palestra Music Player / استمتع بالاستماع مع بلسترا بلاير!`;

      return res.json({
        success: true,
        lyrics: fallbackLyrics,
        title: song,
        artist: artist || "Unknown",
        isFallback: true
      });
    }

    res.json({
      success: true,
      lyrics: lyricsText.trim(),
      title: song,
      artist: artist || "Unknown"
    });
  });

  // 2. Text-Based LRC Synchronizer Endpoint (via OpenRouter NVIDIA Nemotron-3)
  app.post("/api/generate-lrc", rateLimiter, async (req: express.Request, res: express.Response) => {
    const { song, artist, plainLyrics } = req.body;

    if (!song) {
      return res.status(400).json({
        success: false,
        error: 'Song title is required / اسم الأغنية مطلوب'
      });
    }

    try {
      const lrc = await generateLrcFromText(song, artist, plainLyrics);
      res.json({
        success: true,
        lrc,
        model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
      });
    } catch (err: any) {
      console.error('[LRC Text Error]', err.message || err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to generate LRC lyrics from text.'
      });
    }
  });

  // 3. Audio-Based LRC Neural Speech Transcription Endpoint (via Google Gemini 3.5 Flash)
  app.post("/api/generate-lrc-audio", rateLimiter, async (req: express.Request, res: express.Response) => {
    const { song, artist, plainLyrics, audioBase64, mimeType } = req.body;

    if (!song) {
      return res.status(400).json({
        success: false,
        error: 'Song title is required / اسم الأغنية مطلوب'
      });
    }

    if (!audioBase64) {
      return res.status(400).json({
        success: false,
        error: 'Audio binary payload is required for neural tracking / ملف الصوت مطلوب لبدء المزامنة العصبية'
      });
    }

    try {
      const lrc = await generateLrcFromAudio(audioBase64, mimeType, song, artist, plainLyrics);
      res.json({
        success: true,
        lrc,
        model: "gemini-3.5-flash"
      });
    } catch (err: any) {
      console.error('[LRC Audio Sync Error]', err.message || err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to process audio tracking. Ensure GEMINI_API_KEY is configured in Settings.'
      });
    }
  });

  // 4. YouTube Video Search Proxy (highly robust scraper fallback)
  app.get("/api/youtube-search", rateLimiter, async (req: express.Request, res: express.Response) => {
    const query = req.query.q;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required / كلمة البحث مطلوبة'
      });
    }

    try {
      const results = await searchYouTubeOnServer(query);
      res.json({
        success: true,
        results
      });
    } catch (err: any) {
      console.error('[YouTube Search Error]', err.message || err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to search YouTube videos.'
      });
    }
  });

  // Serve with Vite in development, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully running on port http://localhost:${PORT}`);
  });
}

startServer();
