import { getInnertube } from './innertubeClient';
import { YTMusicSearchResults, YTMusicSong, YTMusicAlbum, YTMusicArtist } from './youtubeMusic.types';
import { searchYouTubeOnServer } from './youtubeSearch';

// Singleton instance for youtubei.js
async function getMusicClient() {
  return await getInnertube();
}

// In-memory Cache
const searchCache = new Map<string, { data: YTMusicSearchResults; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 500;

// Circuit Breaker State
let tier1FailureCount = 0;
let lastTier1FailureTime = 0;
const FAILURE_THRESHOLD = 5;
const COOLDOWN_PERIOD = 2 * 60 * 1000; // 2 minutes

function isTier1Available(): boolean {
  if (tier1FailureCount >= FAILURE_THRESHOLD) {
    const now = Date.now();
    if (now - lastTier1FailureTime < COOLDOWN_PERIOD) {
      return false;
    }
    // Cooldown finished, try again
    tier1FailureCount = 0;
  }
  return true;
}

export async function searchYouTubeMusic(query: string): Promise<YTMusicSearchResults> {
  const normalizedQuery = query.toLowerCase().trim();
  
  // 0. Check Cache
  const cached = searchCache.get(normalizedQuery);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[YTMusic] Cache HIT for: ${normalizedQuery}`);
    return cached.data;
  }

  let results: YTMusicSearchResults = {
    songs: [],
    albums: [],
    artists: [],
    source: 'ytmusic'
  };

  // Tier 1: youtubei.js
  if (isTier1Available()) {
    try {
      const client = await getMusicClient();
      if (client) {
        console.log(`[YTMusic Tier1] Fetching: ${query}`);
        const searchRes = await Promise.race([
          client.music.search(query),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
        ]) as any;

        if (searchRes && searchRes.contents) {
          // Parse results
          const songs: YTMusicSong[] = [];
          const albums: YTMusicAlbum[] = [];
          const artists: YTMusicArtist[] = [];

          searchRes.contents.forEach((section: any) => {
            const title = section.title?.toString() || '';
            const items = section.contents || [];

            if (title === 'Songs' || title === 'Videos') {
              items.forEach((item: any) => {
                if (item.type === 'Song' || item.type === 'Video') {
                  songs.push({
                    type: 'song' as const,
                    videoId: item.id,
                    title: item.title?.toString() || '',
                    artist: item.artists?.[0]?.name?.toString() || item.author?.name?.toString() || 'Unknown Artist',
                    album: item.album?.name?.toString(),
                    duration: item.duration?.text || '0:00',
                    durationSeconds: item.duration?.seconds || 0,
                    thumbnail: item.thumbnails?.[0]?.url || '',
                    isExplicit: item.is_explicit || false
                  });
                }
              });
            } else if (title === 'Albums') {
              items.forEach((item: any) => {
                albums.push({
                  type: 'album' as const,
                  albumId: item.id,
                  title: item.title?.toString() || '',
                  artist: item.author?.name?.toString() || 'Unknown Artist',
                  year: item.year?.toString(),
                  thumbnail: item.thumbnails?.[0]?.url || '',
                  trackCount: parseInt(item.song_count) || undefined
                });
              });
            } else if (title === 'Artists') {
              items.forEach((item: any) => {
                artists.push({
                  type: 'artist' as const,
                  artistId: item.id,
                  name: item.name?.toString() || '',
                  thumbnail: item.thumbnails?.[0]?.url || '',
                  subscriberCount: item.subscribers?.toString()
                });
              });
            }
          });

          // Extract Top Result
          const topResultSection = searchRes.contents.find((s: any) => s.title?.toString() === 'Top result');
          if (topResultSection && topResultSection.contents?.[0]) {
            const tr = topResultSection.contents[0];
            if (tr.type === 'Song' || tr.type === 'Video') {
              results.topResult = {
                type: 'song' as const,
                videoId: tr.id,
                title: tr.title?.toString() || '',
                artist: tr.artists?.[0]?.name?.toString() || 'Unknown Artist',
                duration: tr.duration?.text || '0:00',
                durationSeconds: tr.duration?.seconds || 0,
                thumbnail: tr.thumbnails?.[0]?.url || '',
                isExplicit: tr.is_explicit || false
              };
            }
          }

          results.songs = songs;
          results.albums = albums;
          results.artists = artists;
          results.source = 'ytmusic';

          if (songs.length > 0) {
            tier1FailureCount = 0; // Reset failure count on success
            updateCache(normalizedQuery, results);
            return results;
          }
        }
      }
    } catch (err) {
      console.error('[YTMusic Tier1] Failed:', err);
      tier1FailureCount++;
      lastTier1FailureTime = Date.now();
    }
  }

  // Tier 2: Fallback to existing searchYouTubeOnServer
  console.log(`[YTMusic Tier2 Fallback] Fetching: ${query}`);
  try {
    const fallbackResults = await searchYouTubeOnServer(query);
    results.songs = fallbackResults.map(r => ({
      type: 'song' as const,
      videoId: r.videoId || '',
      title: r.title,
      artist: r.channelName,
      duration: r.duration || '0:00',
      durationSeconds: 0, // Not available from fallback easily
      thumbnail: r.thumbnail,
      isExplicit: false
    })).filter(s => s.videoId !== '');
    
    results.source = 'proxy_fallback';
    updateCache(normalizedQuery, results);
    return results;
  } catch (err) {
    console.error('[YTMusic Tier2] Failed:', err);
  }

  return results; // Return empty structure if all else fails
}

function updateCache(key: string, data: YTMusicSearchResults) {
  if (searchCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    searchCache.delete(oldestKey);
  }
  searchCache.set(key, { data, timestamp: Date.now() });
}

// Album Detail Fetcher
export async function getAlbumDetails(albumId: string) {
  try {
    const client = await getMusicClient();
    if (!client) return null;
    const album = await client.music.getAlbum(albumId) as any;
    return {
      title: album.title,
      artist: album.artists?.[0]?.name || 'Unknown Artist',
      year: album.year,
      thumbnail: album.thumbnails?.[0]?.url,
      trackCount: album.track_count,
      tracks: album.contents?.map((item: any) => ({
        videoId: item.id,
        title: item.title,
        artist: item.artists?.[0]?.name || album.artists?.[0]?.name || 'Unknown Artist',
        duration: item.duration?.text || '0:00',
        durationSeconds: item.duration?.seconds || 0,
        thumbnail: item.thumbnails?.[0]?.url || album.thumbnails?.[0]?.url || '',
        isExplicit: item.is_explicit || false
      })) || []
    };
  } catch (err) {
    console.error('[YTMusic] getAlbumDetails failed:', err);
    return null;
  }
}

// Artist Detail Fetcher
export async function getArtistDetails(artistId: string) {
  try {
    const client = await getMusicClient();
    if (!client) return null;
    const artist = await client.music.getArtist(artistId) as any;
    
    return {
      name: artist.name,
      thumbnail: artist.thumbnails?.[0]?.url,
      description: artist.description,
      topSongs: artist.sections?.find((s: any) => s.title?.toString() === 'Songs')?.contents?.map((item: any) => ({
        videoId: item.id,
        title: item.title,
        artist: artist.name,
        duration: item.duration?.text || '0:00',
        durationSeconds: item.duration?.seconds || 0,
        thumbnail: item.thumbnails?.[0]?.url || '',
        isExplicit: item.is_explicit || false
      })) || [],
      albums: artist.sections?.find((s: any) => s.title?.toString() === 'Albums')?.contents?.map((item: any) => ({
        albumId: item.id,
        title: item.title,
        artist: artist.name,
        year: item.year?.toString(),
        thumbnail: item.thumbnails?.[0]?.url || ''
      })) || []
    };
  } catch (err) {
    console.error('[YTMusic] getArtistDetails failed:', err);
    return null;
  }
}

// Lyrics Fetcher
export async function getLyricsForTrack(videoId: string, title: string, artist: string, durationSeconds: number): Promise<string> {
  // Tier A: youtubei.js
  try {
    const client = await getMusicClient();
    if (client) {
      const info = await client.music.getInfo(videoId) as any;
      const lyricsSection = await info.getLyrics();
      if (lyricsSection && lyricsSection.description?.toString()) {
        console.log(`[Lyrics] Found on YT Music for: ${videoId}`);
        return lyricsSection.description.toString();
      }
    }
  } catch (err) {
    // console.log('[Lyrics] Tier A failed:', err.message);
  }

  // Tier B: LRCLIB
  try {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      duration: String(durationSeconds),
    });
    const res = await fetch(`https://lrclib.net/api/get?${params}`);
    if (res.ok) {
      const data = await res.json();
      // Confidence check: duration difference <= 2 seconds
      if (Math.abs(data.duration - durationSeconds) <= 2) {
        console.log(`[Lyrics] Found on LRCLIB for: ${title} - ${artist}`);
        return data.syncedLyrics || data.plainLyrics || '';
      }
    }
  } catch (err) {
    // console.log('[Lyrics] Tier B failed:', err.message);
  }

  return '';
}
