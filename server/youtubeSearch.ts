import { GoogleGenAI, Type } from "@google/genai";

interface YouTubeVideo {
  videoId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration: string;
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("[YouTubeSearch] GEMINI_API_KEY is not configured.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
  }
  return aiClient;
}

async function searchYouTubeViaGemini(query: string): Promise<YouTubeVideo[]> {
  const client = getAiClient();
  if (!client) return [];

  try {
    console.log(`[YouTubeSearch] Directing search grounding via Gemini 3.5 for: "${query}"`);
    const systemInstruction = `You are a specialized YouTube search assistant. Your job is to search Google/YouTube using your googleSearch tool for the query and extract a list of real, valid YouTube videos. 
Ensure you return only real YouTube videoIds. Match videoIds like "dQw4w9WgXcQ" from actual YouTube URLs in your search results. Do not hallucinate or guess. Keep the durations realistic.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Search YouTube for: "${query}". Return the top 10 relevant videos with real video IDs.`,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              videoId: { type: Type.STRING, description: "The exact 11-character YouTube video ID" },
              title: { type: Type.STRING, description: "The video title" },
              channelName: { type: Type.STRING, description: "The channel/uploader name" },
              thumbnail: { type: Type.STRING, description: "The thumbnail URL" },
              duration: { type: Type.STRING, description: "The video duration in MM:SS format" }
            },
            required: ["videoId", "title", "channelName", "thumbnail", "duration"]
          }
        }
      }
    });

    if (response.text) {
      const results = JSON.parse(response.text.trim());
      if (Array.isArray(results) && results.length > 0) {
        const sanitized = results.map((item: any) => {
          let videoId = item.videoId || "";
          if (videoId.includes("youtube.com") || videoId.includes("youtu.be")) {
            try {
              const urlObj = new URL(videoId.startsWith("http") ? videoId : `https://${videoId}`);
              videoId = urlObj.searchParams.get("v") || urlObj.pathname.split("/").pop() || videoId;
            } catch (e) {
              // Ignore parser error
            }
          }
          videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 11);
          return {
            videoId,
            title: item.title || "Unknown Track",
            channelName: item.channelName || "Unknown Artist",
            thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : (item.thumbnail || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17"),
            duration: item.duration || "3:00"
          };
        }).filter((item: any) => item.videoId && item.videoId.length === 11);

        if (sanitized.length > 0) {
          console.log(`[YouTubeSearch] Gemini search grounding successfully returned ${sanitized.length} high-fidelity results!`);
          return sanitized;
        }
      }
    }
  } catch (err: any) {
    console.error("[YouTubeSearch] Gemini search grounding failed:", err.message || err);
  }
  return [];
}

/**
 * Recursively extracts all videoRenderer nodes from ytInitialData tree without duplicate videoIds
 */
function extractVideoRenderers(obj: any, list: any[] = [], seenIds: Set<string> = new Set()): any[] {
  if (!obj || typeof obj !== 'object') return list;
  
  if (obj.videoRenderer) {
    const vr = obj.videoRenderer;
    const videoId = vr.videoId;
    if (videoId && !seenIds.has(videoId)) {
      seenIds.add(videoId);
      list.push(vr);
    }
  }
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      extractVideoRenderers(item, list, seenIds);
    }
  } else {
    for (const key of Object.keys(obj)) {
      extractVideoRenderers(obj[key], list, seenIds);
    }
  }
  
  return list;
}

/**
 * List of highly reliable and active public Invidious instances to use as fallback
 */
const INVIDIOUS_INSTANCES = [
  "yewtu.be",
  "invidious.flokinet.to",
  "iv.melmac.space",
  "invidious.projectsegfaut.im",
  "invidious.perennialte.ch",
  "invidious.nerdvpn.de",
  "invidio.xamh.de",
  "invidious.lunar.icu",
  "iv.ggtyler.dev"
];

/**
 * Robust fetch helper with timeout to avoid hanging on slow nodes
 */
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Fetch search results from a single Invidious instance.
 */
async function searchSingleInvidious(instance: string, query: string): Promise<YouTubeVideo[]> {
  const url = `https://${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
  console.log(`[YouTubeSearch] Raced fetch launched for instance: ${instance}`);

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    },
    2500 // 2.5s limit per query to keep things extremely responsive
  );

  if (!response.ok) {
    throw new Error(`Instance ${instance} returned status ${response.status}`);
  }

  const items = await response.json();
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Instance ${instance} returned empty or invalid results`);
  }

  const videos: YouTubeVideo[] = items
    .filter((item: any) => item.type === 'video' && item.videoId)
    .map((item: any) => {
      const seconds = item.lengthSeconds || 0;
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      const duration = `${m}:${s < 10 ? '0' : ''}${s}`;
      return {
        videoId: item.videoId,
        title: item.title || "Unknown Track",
        channelName: item.author || "Unknown Artist",
        thumbnail: `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
        duration
      };
    });

  if (videos.length === 0) {
    throw new Error(`Instance ${instance} returned 0 valid video items`);
  }

  console.log(`[YouTubeSearch] Instance [${instance}] WON the search race with ${videos.length} results!`);
  return videos;
}

/**
 * Queries a list of public Invidious API search endpoints IN PARALLEL to fetch YouTube videos
 * without getting blocked or triggering Vercel 10s Serverless timeouts.
 */
async function searchYouTubeViaInvidious(query: string): Promise<YouTubeVideo[]> {
  const activeInstances = [
    "yewtu.be",
    "invidious.flokinet.to",
    "iv.melmac.space",
    "invidious.projectsegfaut.im",
    "invidious.nerdvpn.de",
    "invidious.perennialte.ch",
    "invidio.xamh.de",
    "iv.ggtyler.dev",
    "invidious.lunar.icu",
    "invidious.no-logs.com",
    "inv.tux.im"
  ];

  console.log(`[YouTubeSearch] Starting parallel search race across ${activeInstances.length} Invidious instances...`);

  return new Promise<YouTubeVideo[]>((resolve) => {
    let resolved = false;
    let failedCount = 0;
    const errors: string[] = [];

    // Safety timeout of 4.5 seconds to ensure Vercel never times out
    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("[YouTubeSearch] Parallel Invidious race timed out at 4.5s.");
        resolve([]);
      }
    }, 4500);

    activeInstances.forEach((instance) => {
      searchSingleInvidious(instance, query)
        .then((results) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(safetyTimeout);
            resolve(results);
          }
        })
        .catch((err: any) => {
          failedCount++;
          errors.push(`${instance}: ${err.message || err}`);
          if (failedCount === activeInstances.length && !resolved) {
            resolved = true;
            clearTimeout(safetyTimeout);
            console.error("[YouTubeSearch] All Invidious instances in the parallel race failed:", errors.join(" | "));
            resolve([]);
          }
        });
    });
  });
}

/**
 * Searches YouTube for videos matching the query, using high-fidelity HTML scraping
 * of ytInitialData (no API key required).
 */
export async function searchYouTubeOnServer(query: string): Promise<YouTubeVideo[]> {
  // Tier 1: Try Gemini Search Grounding first (highly reliable on Vercel/Cloud Run)
  try {
    const geminiResults = await searchYouTubeViaGemini(query);
    if (geminiResults && geminiResults.length > 0) {
      return geminiResults;
    }
  } catch (err: any) {
    console.error("[YouTubeSearch] searchYouTubeViaGemini failed, falling back to scraper:", err.message || err);
  }

  try {
    // No sp filters to ensure maximum broad relevance / search is "محرية"
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    console.log(`[YouTubeSearch] Scraping results from: ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      }
    });

    if (!response.ok) {
      throw new Error(`YouTube returned status ${response.status}`);
    }

    // Check for soft-blocks (200 response but no real content)
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      console.warn('[YouTubeSearch] Unexpected content-type:', contentType);
      return await searchYouTubeViaInvidious(query);
    }

    const html = await response.text();
    
    // Look for ytInitialData JSON object
    let ytInitialData: any = null;
    // USE THIS — indexOf-based extraction handles huge JSON correctly
    const marker = 'ytInitialData = ';
    const startIdx = html.indexOf(marker);
    if (startIdx !== -1) {
      const jsonStart = startIdx + marker.length;
      // Find the closing script tag boundary after the JSON
      const scriptEnd = html.indexOf(';</script>', jsonStart);
      const semiEnd = html.indexOf(';', jsonStart);
      const endIdx = scriptEnd !== -1 ? scriptEnd : semiEnd;
      if (endIdx !== -1) {
        const rawJson = html.slice(jsonStart, endIdx);
        try {
          ytInitialData = JSON.parse(rawJson);
        } catch (e: any) {
          console.error('[YouTubeSearch] JSON parse error:', e.message?.slice(0, 100));
        }
      }
    }

    // Also detect bot-detection / consent pages before processing
    if (!ytInitialData) {
      const isConsentPage = html.includes('consent.youtube.com') || html.includes('www.google.com/sorry');
      if (isConsentPage) {
        console.warn('[YouTubeSearch] Bot detection / consent page returned. Results unavailable. Falling back to Invidious API...');
      } else {
        console.warn('[YouTubeSearch] Could not extract ytInitialData from response. Falling back to Invidious API...');
      }
      return await searchYouTubeViaInvidious(query);
    }

    // Recursively extract all videoRenderer nodes present in the body to ensure we don't miss anything!
    const rawRenderers = extractVideoRenderers(ytInitialData);
    
    const videos: YouTubeVideo[] = [];
    for (const vr of rawRenderers) {
      const videoId = vr.videoId;
      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || "Unknown Track";
      const channelName = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Artist";
      let thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || "";
      // Fix relative thumbnails or protocol omission
      if (thumbnail.startsWith('//')) {
        thumbnail = 'https:' + thumbnail;
      }
      const duration = vr.lengthText?.simpleText || "0:00";

      if (videoId && title) {
        videos.push({
          videoId,
          title,
          channelName,
          thumbnail,
          duration
        });
      }
    }

    console.log(`[YouTubeSearch] Successfully parsed ${videos.length} videos recursively.`);
    if (videos.length === 0) {
      console.log('[YouTubeSearch] Scraping returned 0 videos. Falling back to Invidious API...');
      return await searchYouTubeViaInvidious(query);
    }
    // Return up to 15-20 results for a rich search experience, satisfying free-form request
    return videos.slice(0, 20);
  } catch (error: any) {
    console.error("[YouTubeSearch Server Error]", error.message || error);
    console.log('[YouTubeSearch] Error encountered. Falling back to Invidious API...');
    return await searchYouTubeViaInvidious(query);
  }
}
