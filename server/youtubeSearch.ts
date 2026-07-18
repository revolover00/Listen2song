import { getInnertube } from './innertubeClient';

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
    "invidious.io",
    "yewtu.be",
    "iv.melmac.space",
    "invidious.projectsegfaut.im",
    "invidious.privacydev.net",
    "invidious.tiekoetter.com",
    "invidious.perennialte.ch",
    "iv.ggtyler.dev",
    "invidious.lunar.icu",
    "invidious.snopyta.org",
    "invidious.flokinet.to",
    "invidio.xamh.de",
    "invidious.materialistic.site",
    "invidious.dhusch.de",
    "invidious.mutatun.com",
    "invidious.pistasjis.net",
    "invidious.esmailelbob.xyz",
    "iv.nboeck.de"
  ];

  const pipedInstances = [
    "pipedapi.kavin.rocks",
    "pipedapi.adminforge.de",
    "pipedapi.astphy.com",
    "pipedapi.swg.rocks",
    "pipedapi.official-esc.workers.dev",
    "pipedapi.moomoo.me",
    "pipedapi.rinu.moe",
    "pipedapi.us.to",
    "pipedapi.lule.io",
    "pipedapi.leptons.xyz",
    "pipedapi.mha.fi",
    "pipedapi.tokhmi.xyz",
    "piped-api.lule.io",
    "pipedapi.silly.computer"
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
  // Tier 1: Try parallel Invidious + Piped API proxy race
  try {
    const proxyResults = await searchYouTubeViaApiProxies(query);
    if (proxyResults && proxyResults.length > 0) {
      console.log(`[YouTubeSearch] Tier 1 SUCCESS (${proxyResults.length} results)`);
      return proxyResults;
    }
  } catch (err: any) {
    console.error("[YouTubeSearch] Tier 1 failed:", err.message || err);
  }

  // Tier 2: Innertube Fallback (High Quality, uses official client)
  try {
    console.log(`[YouTubeSearch] Tier 2: Falling back to Innertube for: ${query}`);
    const client = await getInnertube();
    const search = await client.search(query, { type: 'video' });
    
    if (search.results && search.results.length > 0) {
      const results: YouTubeSearchResult[] = search.results
        .map((item: any) => {
          if (item.type === 'Video') {
            return {
              videoId: item.id,
              title: item.title?.toString() || 'Unknown Track',
              channelName: item.author?.name?.toString() || 'Unknown Artist',
              thumbnail: item.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
              duration: item.duration?.toString() || '0:00'
            };
          }
          return null;
        })
        .filter(r => r !== null) as YouTubeSearchResult[];
      
      if (results.length > 0) {
        console.log(`[YouTubeSearch] Tier 2 SUCCESS (${results.length} results)`);
        return results;
      }
    }
  } catch (err: any) {
    console.error("[YouTubeSearch] Tier 2 failed:", err.message || err);
  }

  // Tier 3: Scraping fallback (Last resort)
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    console.log(`[YouTubeSearch] Tier 3: Scraping results from: ${url}`);
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
      return await searchYouTubeViaApiProxies(query);
    }
    return videos.slice(0, 20);
  } catch (error: any) {
    console.error("[YouTubeSearch Server Error]", error.message || error);
    return await searchYouTubeViaApiProxies(query);
  }
}
