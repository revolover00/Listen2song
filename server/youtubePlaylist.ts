
export interface PlaylistItem {
  videoId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration: string;
}

export interface PlaylistDetails {
  playlistId: string;
  title: string;
  author: string;
  videoCount: number;
  tracks: PlaylistItem[];
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
 * Fetch from single Invidious Instance
 */
async function fetchInvidiousPlaylist(instance: string, playlistId: string): Promise<PlaylistDetails> {
  const url = `https://${instance}/api/v1/playlists/${playlistId}`;
  console.log(`[YouTubePlaylist] Raced fetch launched for Invidious: ${instance}`);

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    },
    3000
  );

  if (!response.ok) {
    throw new Error(`Instance ${instance} returned status ${response.status}`);
  }

  const data = await response.json();
  const rawVideos = data.videos;
  if (!Array.isArray(rawVideos) || rawVideos.length === 0) {
    throw new Error(`Instance ${instance} returned empty playlist or invalid schema`);
  }

  const tracks: PlaylistItem[] = rawVideos
    .filter((item: any) => parseVideoId(item))
    .map((item: any) => {
      const videoId = parseVideoId(item) || "";
      const seconds = item.lengthSeconds || 0;
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      const duration = `${m}:${s < 10 ? '0' : ''}${s}`;
      return {
        videoId,
        title: item.title || "Unknown Track",
        channelName: item.author || "Unknown Artist",
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        duration
      };
    });

  return {
    playlistId,
    title: data.title || "YouTube Playlist",
    author: data.author || "Unknown Channel",
    videoCount: data.videoCount || tracks.length,
    tracks
  };
}

/**
 * Fetch from single Piped Instance
 */
async function fetchPipedPlaylist(instance: string, playlistId: string): Promise<PlaylistDetails> {
  const url = `https://${instance}/playlists/${playlistId}`;
  console.log(`[YouTubePlaylist] Raced fetch launched for Piped: ${instance}`);

  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    },
    3000
  );

  if (!response.ok) {
    throw new Error(`Instance ${instance} returned status ${response.status}`);
  }

  const data = await response.json();
  const rawStreams = data.relatedStreams;
  if (!Array.isArray(rawStreams) || rawStreams.length === 0) {
    throw new Error(`Instance ${instance} returned empty playlist streams`);
  }

  const tracks: PlaylistItem[] = rawStreams
    .filter((item: any) => parseVideoId(item))
    .map((item: any) => {
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
    });

  return {
    playlistId,
    title: data.name || "YouTube Playlist",
    author: data.uploader || "Unknown Channel",
    videoCount: data.videoCount || tracks.length,
    tracks
  };
}

const playlistCache = new Map<string, { data: PlaylistDetails; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Races multiple public Invidious & Piped APIs to fetch YouTube Playlists
 */
export async function fetchYouTubePlaylistOnServer(playlistId: string): Promise<PlaylistDetails> {
  const cached = playlistCache.get(playlistId);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[YouTubePlaylist] Serving from cache for Playlist ID: ${playlistId}`);
    return cached.data;
  }

  const invidiousInstances = [
    "yewtu.be",
    "invidious.privacydev.net",
    "invidious.lunar.icu",
    "invidious.nerdvpn.de",
    "iv.melmac.space",
    "invidious.flokinet.to"
  ];

  const pipedInstances = [
    "piped.video",
    "piped.kavin.rocks",
    "piped.projectsegfaut.im",
    "piped.adminforge.de"
  ];

  const totalCount = invidiousInstances.length + pipedInstances.length;
  console.log(`[YouTubePlaylist] Racing ${totalCount} proxy endpoints for Playlist ID: ${playlistId}`);

  return new Promise<PlaylistDetails>((resolve, reject) => {
    let resolved = false;
    let failedCount = 0;
    const errors: string[] = [];

    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("YouTube playlist retrieval timed out after 5.5s. Please try again."));
      }
    }, 5500);

    const handleSuccess = (result: PlaylistDetails, instance: string, type: string) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        console.log(`[YouTubePlaylist] Playlist retrieved successfully from [${type}:${instance}] with ${result.tracks.length} tracks!`);
        
        // Cache the result
        playlistCache.set(playlistId, { data: result, timestamp: Date.now() });
        
        resolve(result);
      }
    };

    const handleFailure = (err: any, instance: string, type: string) => {
      failedCount++;
      errors.push(`${type}:${instance} (${err.message || err})`);
      if (failedCount === totalCount && !resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        
        // Try fallback to cached data even if expired
        const cached = playlistCache.get(playlistId);
        if (cached) {
          console.log(`[YouTubePlaylist] All nodes failed, falling back to cached data for Playlist ID: ${playlistId}`);
          resolve(cached.data);
          return;
        }

        reject(new Error(`Failed to load YouTube playlist from all available proxy nodes. Details: ${errors.slice(0, 3).join(' | ')}`));
      }
    };

    // 1. Launch Invidious fetch requests
    invidiousInstances.forEach((instance) => {
      fetchInvidiousPlaylist(instance, playlistId)
        .then((result) => handleSuccess(result, instance, "Invidious"))
        .catch((err) => handleFailure(err, instance, "Invidious"));
    });

    // 2. Launch Piped fetch requests
    pipedInstances.forEach((instance) => {
      fetchPipedPlaylist(instance, playlistId)
        .then((result) => handleSuccess(result, instance, "Piped"))
        .catch((err) => handleFailure(err, instance, "Piped"));
    });
  });
}
