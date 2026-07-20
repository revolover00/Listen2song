import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dns from "dns";
import { generateLrcFromAudio, generateLrcFromText, fetchLyricsFromGemini } from "./server/lrcEngine";
import { searchYouTubeOnServer } from "./server/youtubeSearch";
import { fetchYouTubePlaylistOnServer } from "./server/youtubePlaylist";

// Set default DNS resolution to ipv4 first to avoid slow localhost resolving issues
dns.setDefaultResultOrder("ipv4first");

const app = express();

async function startServer() {
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

    // Phase 2: Fallback plain lyrics finder using OpenRouter
    if (!lyricsText) {
      try {
        console.log(`[PlainLyricsRequest] Requesting plain lyrics via OpenRouter fallback for: "${song}"`);
        lyricsText = await fetchLyricsFromGemini(song, artist);
      } catch (fallbackErr: any) {
        console.error(`[PlainLyricsRequest] Fallback failed:`, fallbackErr.message || fallbackErr);
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
    let { song, artist, plainLyrics } = req.body;

    if (!song || typeof song !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Song title is required and must be a string / اسم الأغنية مطلوب ويجب أن يكون نصاً'
      });
    }

    artist = typeof artist === 'string' ? artist.trim() : '';
    plainLyrics = typeof plainLyrics === 'string' ? plainLyrics.trim() : '';

    try {
      const lrc = await generateLrcFromText(song.trim(), artist, plainLyrics);
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

  // 3. Audio-Based LRC Neural Speech Transcription Endpoint (Disabled)
  app.post("/api/generate-lrc-audio", rateLimiter, async (req: express.Request, res: express.Response) => {
    let { song, artist, plainLyrics, audioBase64, mimeType } = req.body;

    if (!song || typeof song !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Song title is required and must be a string / اسم الأغنية مطلوب ويجب أن يكون نصاً'
      });
    }

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Audio binary payload is required for neural tracking and must be a string / ملف الصوت مطلوب لبدء المزامنة العصبية ويجب أن يكون نصاً'
      });
    }

    artist = typeof artist === 'string' ? artist.trim() : '';
    plainLyrics = typeof plainLyrics === 'string' ? plainLyrics.trim() : '';
    mimeType = typeof mimeType === 'string' ? mimeType.trim() : 'audio/mp3';

    try {
      const lrc = await generateLrcFromAudio(audioBase64, mimeType, song.trim(), artist, plainLyrics);
      res.json({
        success: true,
        lrc,
        model: "audio-synchronizer"
      });
    } catch (err: any) {
      console.error('[LRC Audio Sync Error]', err.message || err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to process audio tracking.'
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

  // YouTube Playlist Proxy Endpoint
  app.get("/api/youtube-playlist", rateLimiter, async (req: express.Request, res: express.Response) => {
    const listId = req.query.list;
    if (!listId || typeof listId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Playlist ID "list" is required / معرف قائمة التشغيل مطلوب'
      });
    }

    try {
      console.log(`[YouTubePlaylist API] Fetching playlist: ${listId}`);
      const playlist = await fetchYouTubePlaylistOnServer(listId);
      res.json({
        success: true,
        playlist
      });
    } catch (err: any) {
      console.error('[YouTube Playlist Route Error]', err.message || err);
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to load YouTube playlist from proxy nodes.'
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
}

startServer();

export default app;
