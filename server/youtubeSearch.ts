interface YouTubeVideo {
  videoId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration: string;
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
 * Searches YouTube for videos matching the query, using high-fidelity HTML scraping
 * of ytInitialData (no API key required).
 */
export async function searchYouTubeOnServer(query: string): Promise<YouTubeVideo[]> {
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
      return [];
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
        console.warn('[YouTubeSearch] Bot detection / consent page returned. Results unavailable.');
      } else {
        console.warn('[YouTubeSearch] Could not extract ytInitialData from response.');
      }
      return [];
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
    // Return up to 15-20 results for a rich search experience, satisfying free-form request
    return videos.slice(0, 20);
  } catch (error: any) {
    console.error("[YouTubeSearch Server Error]", error.message || error);
    return [];
  }
}
