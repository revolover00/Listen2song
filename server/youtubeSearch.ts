export interface YouTubeSearchResult {
  videoId?: string;
  playlistId?: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration?: string;
  videoCount?: number;
  desc?: string;
  isPlaylist?: boolean;
}

const EXCLUDE_KEYWORDS = [
  'live', 'trailer', 'interview', 'reaction', 'tutorial', 'how to',
  'unboxing', 'review', 'gameplay', 'highlights', 'teaser',
  'behind the scenes', 'podcast', 'episode', 'vlog', 'shorts',
  'full match', 'press conference', 'documentary'
];

function isLikelySong(item: YouTubeSearchResult): boolean {
  if (item.isPlaylist) return true;

  const title = (item.title || '').toLowerCase();
  if (EXCLUDE_KEYWORDS.some(kw => title.includes(kw))) return false;

  if (item.duration) {
    const parts = item.duration.split(':').map(Number);
    const seconds = parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : 0;

    if (seconds > 0 && (seconds < 45 || seconds > 900)) return false;
    if (seconds === 0) return false;
  }

  return true;
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
 * Fetch search results from a single Invidious instance, requesting both videos and playlists.
 */
async function searchSingleInvidious(instance: string, query: string): Promise<YouTubeSearchResult[]> {
  const url = `https://${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=all`;
  console.log(`[YouTubeSearch] Raced fetch launched for Invidious instance: ${instance}`);

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

  const results: YouTubeSearchResult[] = items
    .map((item: any) => {
      if (item.type === 'video' && item.videoId) {
        if (item.liveNow === true) return null; // Added live stream check
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
      } else if (item.type === 'playlist' && item.playlistId) {
        return {
          playlistId: item.playlistId,
          title: item.title || "Unknown Playlist",
          channelName: item.author || "YouTube Playlist",
          thumbnail: item.playlistThumbnail || `https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80`,
          videoCount: item.videoCount || 0,
          desc: `Playlist by ${item.author || 'Creator'}`,
          isPlaylist: true
        };
      }
      return null;
    })
    .filter((item) => item !== null) as YouTubeSearchResult[];

  if (results.length === 0) {
    throw new Error(`Instance ${instance} returned 0 valid items`);
  }

  console.log(`[YouTubeSearch] Instance [${instance}] WON the search race with ${results.length} results (including playlists)!`);
  return results;
}

function parseVideoId(item: any): string | null {
  if (item.videoId && item.videoId.length === 11) return item.videoId;
  if (item.id && item.id.length === 11) return item.id;
  if (item.url) {
    const match = item.url.match(/[?&]v=([^&#]+)/) || item.url.match(/watch\?v=([^&#]+)/);
    if (match && match[1]) {
      return match[1].slice(0, 11);
    }
    const parts = item.url.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart.length === 11) {
      return lastPart;
    }
  }
  return null;
}

/**
 * Fetch search results from a single Piped instance, requesting both streams and playlists.
 */
async function searchSinglePiped(instance: string, query: string): Promise<YouTubeSearchResult[]> {
  const url = `https://${instance}/search?q=${encodeURIComponent(query)}&filter=all`;
  console.log(`[YouTubeSearch] Raced fetch launched for Piped instance: ${instance}`);

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

  const data = await response.json();
  const items = data.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Instance ${instance} returned empty or invalid results`);
  }

  const results: YouTubeSearchResult[] = items
    .map((item: any) => {
      if ((item.type === 'stream' || item.type === 'video') && parseVideoId(item)) {
        const videoId = parseVideoId(item) || "";
        const seconds = item.duration || 0;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const duration = `${m}:${s < 10 ? '0' : ''}${s}`;
        return {
          videoId,
          title: item.title || "Unknown Track",
          channelName: item.uploaderName || item.channelName || "Unknown Artist",
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          duration
        };
      } else if (item.type === 'playlist') {
        let playlistId = item.playlistId;
        if (!playlistId && item.url) {
          const match = item.url.match(/[?&]list=([^&#]+)/);
          playlistId = match ? match[1] : item.url.split('/').pop();
        }
        if (playlistId) {
          return {
            playlistId,
            title: item.title || item.name || "Unknown Playlist",
            channelName: item.uploaderName || "YouTube Playlist",
            thumbnail: item.thumbnail || `https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80`,
            videoCount: item.videos || item.videoCount || 0,
            desc: `Playlist by ${item.uploaderName || 'Creator'}`,
            isPlaylist: true
          };
        }
      }
      return null;
    })
    .filter((item) => item !== null) as YouTubeSearchResult[];

  if (results.length === 0) {
    throw new Error(`Instance ${instance} returned 0 valid items`);
  }

  console.log(`[YouTubeSearch] Piped instance [${instance}] WON the search race with ${results.length} results (including playlists)!`);
  return results;
}

/**
 * Queries a list of public Invidious and Piped API search endpoints IN PARALLEL to fetch YouTube videos and playlists
 */
async function searchYouTubeViaApiProxies(query: string): Promise<YouTubeSearchResult[]> {
  const invidiousInstances = [
    "yewtu.be",
    "invidious.flokinet.to",
    "iv.melmac.space",
    "invidious.projectsegfaut.im",
    "invidious.perennialte.ch",
    "invidious.nerdvpn.de",
    "invidio.xamh.de",
    "iv.ggtyler.dev",
    "invidious.lunar.icu"
  ];

  const pipedInstances = [
    "pipedapi.kavin.rocks",
    "pipedapi.tokhmi.xyz",
    "api.piped.yt",
    "piped-api.lule.io",
    "pipedapi.adminforge.de",
    "pipedapi.astphy.com",
    "pipedapi.swg.rocks",
    "pipedapi.colby.school",
    "pipedapi.us.to"
  ];

  const totalCount = invidiousInstances.length + pipedInstances.length;
  console.log(`[YouTubeSearch] Starting parallel search race across ${totalCount} API proxy endpoints for combined results...`);

  return new Promise<YouTubeSearchResult[]>((resolve) => {
    let resolved = false;
    let failedCount = 0;
    const errors: string[] = [];

    // Safety timeout of 5 seconds to ensure quick completion and prevent server hangs
    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn("[YouTubeSearch] Parallel proxy race timed out at 5s.");
        resolve([]);
      }
    }, 5000);

    const handleSuccess = (results: YouTubeSearchResult[]) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        resolve(results);
      }
    };

    const handleFailure = (err: any, source: string) => {
      failedCount++;
      errors.push(`${source}: ${err.message || err}`);
      if (failedCount === totalCount && !resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        console.error("[YouTubeSearch] All proxy API instances failed:", errors.join(" | "));
        resolve([]);
      }
    };

    // Launch Invidious instances
    invidiousInstances.forEach((instance) => {
      searchSingleInvidious(instance, query)
        .then(handleSuccess)
        .catch((err) => handleFailure(err, `Invidious:${instance}`));
    });

    // Launch Piped instances
    pipedInstances.forEach((instance) => {
      searchSinglePiped(instance, query)
        .then(handleSuccess)
        .catch((err) => handleFailure(err, `Piped:${instance}`));
    });
  });
}

/**
 * Searches YouTube for videos and playlists matching the query (Gemini is completely removed)
 */
export async function searchYouTubeOnServer(query: string): Promise<YouTubeSearchResult[]> {
  // Tier 1: Try parallel Invidious + Piped API proxy race (returns both videos and playlists)
  try {
    const proxyResults = await searchYouTubeViaApiProxies(query);
    if (proxyResults && proxyResults.length > 0) {
      return proxyResults.filter(isLikelySong);
    }
  } catch (err: any) {
    console.error("[YouTubeSearch] searchYouTubeViaApiProxies failed, falling back to scraper:", err.message || err);
  }

  // Tier 2: Scraping fallback (returns videos as last resort)
  try {
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

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return await searchYouTubeViaApiProxies(query);
    }

    const html = await response.text();
    let ytInitialData: any = null;
    const marker = 'ytInitialData = ';
    const startIdx = html.indexOf(marker);
    if (startIdx !== -1) {
      const jsonStart = startIdx + marker.length;
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

    if (!ytInitialData) {
      return await searchYouTubeViaApiProxies(query);
    }

    const rawRenderers = extractVideoRenderers(ytInitialData);
    const videos: YouTubeSearchResult[] = [];
    for (const vr of rawRenderers) {
      const videoId = vr.videoId;
      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || "Unknown Track";
      const channelName = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "Unknown Artist";
      let thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || "";
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

    if (videos.length === 0) {
      return (await searchYouTubeViaApiProxies(query)).filter(isLikelySong);
    }
    return videos.filter(isLikelySong).slice(0, 20);
  } catch (error: any) {
    console.error("[YouTubeSearch Server Error]", error.message || error);
    return (await searchYouTubeViaApiProxies(query)).filter(isLikelySong);
  }
}
