import React, { useState } from 'react';
import { Track } from '../../types';
import { 
  Youtube, 
  Search, 
  XCircle, 
  Loader2, 
  CheckCircle2, 
  Download, 
  Plus, 
  Play, 
  Frown,
  ListMusic,
  Sparkles,
  Clock,
  ChevronRight,
  Music,
  Trash2,
  Layers,
  ArrowLeft,
  Bookmark
} from 'lucide-react';

interface YouTubeSearchViewProps {
  onSelectTrack: (id: string) => void;
  currentTrackId: string | null;
  addTrack: (track: Track) => void;
  updateTrackLyrics: (id: string, lyrics: string) => void;
  tracks: Track[];
  onToggleSave: (trackId: string, isSaved: boolean) => void;
  addToast: (msg: string, type: 'success' | 'info' | 'error') => void;
}

interface SearchResult {
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

interface PlaylistData {
  playlistId: string;
  title: string;
  author: string;
  videoCount: number;
  tracks: SearchResult[];
}

interface PlaylistResult {
  playlistId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  desc: string;
  videoCount: number;
  isPlaylist: true;
}

// 100% Reliable Client-Side Direct Search racing both CORS-friendly Piped and Invidious instances
async function searchYouTubeDirectClientSide(query: string): Promise<SearchResult[]> {
  const invidiousInstances = [
    "yewtu.be",
    "invidious.flokinet.to",
    "iv.melmac.space",
    "invidious.projectsegfaut.im",
    "invidious.perennialte.ch",
    "invidious.nerdvpn.de",
    "invidio.xamh.de",
    "iv.ggtyler.dev",
    "invidious.lunar.icu",
    "invidious.no-logs.com",
    "inv.tux.im"
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
    "pipedapi.us.to",
    "pipedapi.r4fo.com"
  ];

  const totalCount = invidiousInstances.length + pipedInstances.length;
  console.log(`[YouTubeSearchView] Running ultra-fast direct search race across ${totalCount} public endpoints...`);

  return new Promise<SearchResult[]>((resolve) => {
    let resolved = false;
    let finishedCount = 0;
    const controllers: AbortController[] = [];

    // Safety timeout of 4.5 seconds to ensure fast UI response under any network status
    const safetyTimeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        controllers.forEach(c => {
          try { c.abort(); } catch (e) {}
        });
        console.warn("[YouTubeSearchView] Client-side search race timed out.");
        resolve([]);
      }
    }, 4500);

    const handleSuccess = (results: SearchResult[], instance: string, type: 'Piped' | 'Invidious') => {
      if (results.length > 0 && !resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        controllers.forEach(c => {
          try { c.abort(); } catch (e) {}
        });
        console.log(`[YouTubeSearchView] Client direct search race WON by [${type}: ${instance}] with ${results.length} results!`);
        resolve(results);
      }
    };

    const handleFailure = () => {
      finishedCount++;
      if (finishedCount === totalCount && !resolved) {
        resolved = true;
        clearTimeout(safetyTimeout);
        resolve([]);
      }
    };

    // Helper to extract video ID
    const parseVideoId = (item: any): string | null => {
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
    };

    // 1. Launch Invidious instances
    invidiousInstances.forEach((instance) => {
      const controller = new AbortController();
      controllers.push(controller);

      fetch(`https://${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=all`, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const results: SearchResult[] = items
            .map((item: any) => {
              if (item.type === 'video' && parseVideoId(item)) {
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
            .filter((item) => item !== null) as SearchResult[];

          if (results.length > 0) {
            handleSuccess(results, instance, 'Invidious');
          } else {
            throw new Error();
          }
        } else {
          throw new Error();
        }
      })
      .catch(() => {
        handleFailure();
      });
    });

    // 2. Launch Piped instances (which specifically support client-side CORS)
    pipedInstances.forEach((instance) => {
      const controller = new AbortController();
      controllers.push(controller);

      fetch(`https://${instance}/search?q=${encodeURIComponent(query)}&filter=all`, {
        signal: controller.signal
      })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        const items = data.items;
        if (Array.isArray(items) && items.length > 0) {
          const results: SearchResult[] = items
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
            .filter((item) => item !== null) as SearchResult[];

          if (results.length > 0) {
            handleSuccess(results, instance, 'Piped');
          } else {
            throw new Error();
          }
        } else {
          throw new Error();
        }
      })
      .catch(() => {
        handleFailure();
      });
    });
  });
}

export function YouTubeSearchView({
  onSelectTrack,
  currentTrackId,
  addTrack,
  addToast,
  tracks,
  onToggleSave
}: YouTubeSearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleToggleSaveTrack = (trackId: string, title: string, artist: string, thumbnail: string, videoId: string) => {
    const existingTrack = tracks.find(t => t.id === trackId);
    if (existingTrack) {
      const newSavedState = !existingTrack.isSaved;
      onToggleSave(trackId, newSavedState);
      if (newSavedState) {
        addToast(`Saved "${title}" to your list!`, 'success');
      } else {
        addToast(`Removed "${title}" from your list.`, 'info');
      }
    } else {
      const newTrack: Track = {
        id: trackId,
        title: title,
        artist: artist,
        album: 'YouTube Stream',
        audioUrl: videoId,
        coverUrl: thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17',
        lyrics: '',
        source: 'youtube',
        youtubeId: videoId,
        isSaved: true
      };
      addTrack(newTrack);
      onToggleSave(trackId, true);
      addToast(`Saved "${title}" to your list!`, 'success');
    }
  };

  // Playlist States
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);

  // Suggested Playlists to show inline in the video suggestions grid
  const suggestedPlaylists: PlaylistResult[] = [
    { 
      playlistId: "PLofht4PTcTgNoP_t-pZsc667_07n-Z0Yw", 
      title: "🎧 Lofi Chill Beats", 
      channelName: "Lofi Girl", 
      thumbnail: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80",
      desc: "Cozy study beats",
      videoCount: 150,
      isPlaylist: true
    },
    { 
      playlistId: "PLMC9KNkIncKvYin_USF1qoJQnIyMAfRxl", 
      title: "🔥 Top Hits 2026", 
      channelName: "Chart Toppers", 
      thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80",
      desc: "Worldwide chart toppers",
      videoCount: 100,
      isPlaylist: true
    },
    { 
      playlistId: "PLofht4PTcTgM0K_t08n1Z2yv_rL-A1O7h", 
      title: "🎸 Classical Chill", 
      channelName: "Acoustic Vibes", 
      thumbnail: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&q=80",
      desc: "Acoustic & peaceful",
      videoCount: 120,
      isPlaylist: true
    }
  ];

  const quickTags = [
    { label: '🔥 Today\'s Hits', query: 'Popular hit songs 2026 Billboard' },
    { label: '🕺 Dance & EDM', query: 'EDM festival music mix' },
    { label: '🎧 Pop Hits', query: 'pop hits mix popular songs' },
    { label: '✨ Chill Lo-Fi', query: 'lofi hip hop beats study chill' },
    { label: '🎸 Rock Classics', query: 'Rock classics hit songs' },
    { label: '✨ Acoustic Covers', query: 'Acoustic covers playlist' }
  ];

  // Load trending suggestions on mount
  React.useEffect(() => {
    let active = true;
    const fetchInitialSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const defaultQueries = ["Popular hit songs 2026", "Billboard Hot 100 songs", "Viral acoustic hits current"];
        const randomQuery = defaultQueries[Math.floor(Math.random() * defaultQueries.length)];
        
        let searchResults: SearchResult[] = [];
        
        try {
          const direct = await searchYouTubeDirectClientSide(randomQuery);
          if (direct && direct.length > 0) {
            searchResults = direct;
          }
        } catch (e) {
          console.warn("[YouTubeView] Direct client suggestions failed, falling back:", e);
        }

        if (searchResults.length === 0) {
          const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(randomQuery)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.results)) {
              searchResults = data.results;
            }
          }
        }

        if (active && searchResults.length > 0) {
          setSuggestions(searchResults);
          setResults(searchResults);
        }
      } catch (err) {
        console.warn("Could not load initial suggestions:", err);
      } finally {
        if (active) setLoadingSuggestions(false);
      }
    };

    fetchInitialSuggestions();
    return () => { active = false; };
  }, []);

  // Extract YouTube Playlist ID
  const extractPlaylistId = (input: string): string | null => {
    const trimmed = input.trim();
    const match = trimmed.match(/[&?]list=([^&#]+)/);
    if (match && match[1]) {
      return match[1];
    }
    if (trimmed.startsWith('PL') && trimmed.length >= 15) {
      return trimmed;
    }
    return null;
  };

  const handleLoadPlaylist = async (playlistId: string) => {
    setPlaylistLoading(true);
    setPlaylistData(null);
    addToast(`Loading playlist tracks...`, 'info');

    try {
      const res = await fetch(`/api/youtube-playlist?list=${playlistId}`);
      if (!res.ok) {
        throw new Error("Could not retrieve playlist tracks. All proxy nodes returned error.");
      }
      const data = await res.json();
      if (data.success && data.playlist) {
        const p = data.playlist;
        setPlaylistData({
          playlistId: p.playlistId,
          title: p.title || "YouTube Playlist",
          author: p.author || "Unknown Creator",
          videoCount: p.videoCount || p.tracks.length,
          tracks: p.tracks.map((t: any) => ({
            videoId: t.videoId,
            title: t.title,
            channelName: t.channelName,
            thumbnail: t.thumbnail,
            duration: t.duration
          }))
        });
        addToast(`Successfully loaded playlist "${p.title}"`, "success");
      } else {
        throw new Error(data.error || "Playlist not found or empty.");
      }
    } catch (err: any) {
      console.error("Playlist loading error:", err);
      addToast(err.message || "Failed to load playlist. Please check ID or try again.", "error");
    } finally {
      setPlaylistLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = customQuery || query;
    if (!activeQuery.trim()) return;

    // Check if the query is actually a Playlist URL or ID
    const playlistId = extractPlaylistId(activeQuery);
    if (playlistId) {
      handleLoadPlaylist(playlistId);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      let searchResults: SearchResult[] = [];
      
      try {
        const direct = await searchYouTubeDirectClientSide(activeQuery);
        if (direct && direct.length > 0) {
          searchResults = direct;
        }
      } catch (e) {
        console.warn("[YouTubeView] Direct client search failed, falling back:", e);
      }
      
      if (searchResults.length === 0) {
        const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(activeQuery)}`);
        if (!res.ok) {
          throw new Error('Server-side search failed');
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.results)) {
          searchResults = data.results;
        }
      }

      setResults(searchResults);
      if (searchResults.length === 0) {
        addToast("No tracks found for this search. Try other keywords.", "info");
      }
    } catch (err: any) {
      console.error("YouTube search execution failed:", err);
      addToast("Failed to fetch YouTube search results. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayResult = async (item: SearchResult) => {
    const trackId = `youtube-${item.videoId}`;
    const newTrack: Track = {
      id: trackId,
      title: item.title,
      artist: item.channelName,
      album: 'YouTube Stream',
      audioUrl: item.videoId,
      coverUrl: item.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17',
      lyrics: '',
      source: 'youtube',
      youtubeId: item.videoId
    };

    addTrack(newTrack);
    onSelectTrack(trackId);
    addToast(`Playing "${item.title}" from YouTube!`, 'success');
  };

  const handleAddToQueue = (item: SearchResult) => {
    const trackId = `youtube-${item.videoId}`;
    const newTrack: Track = {
      id: trackId,
      title: item.title,
      artist: item.channelName,
      album: 'YouTube Stream',
      audioUrl: item.videoId,
      coverUrl: item.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17',
      lyrics: '',
      source: 'youtube',
      youtubeId: item.videoId
    };

    addTrack(newTrack);
    addToast(`Added "${item.title}" to queue`, 'success');
  };

  const handlePlayAllPlaylist = () => {
    if (!playlistData || playlistData.tracks.length === 0) return;
    
    addToast(`Loading ${playlistData.tracks.length} tracks to queue...`, "info");
    
    // Add all tracks to store
    playlistData.tracks.forEach((item) => {
      const trackId = `youtube-${item.videoId}`;
      const newTrack: Track = {
        id: trackId,
        title: item.title,
        artist: item.channelName,
        album: playlistData.title,
        audioUrl: item.videoId,
        coverUrl: item.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17',
        lyrics: '',
        source: 'youtube',
        youtubeId: item.videoId
      };
      addTrack(newTrack);
    });

    // Play the first track instantly
    const firstTrack = playlistData.tracks[0];
    const firstTrackId = `youtube-${firstTrack.videoId}`;
    onSelectTrack(firstTrackId);

    addToast(`Playing entire playlist "${playlistData.title}"!`, "success");
  };

  const handleQueueAllPlaylist = () => {
    if (!playlistData || playlistData.tracks.length === 0) return;
    playlistData.tracks.forEach((item) => {
      const trackId = `youtube-${item.videoId}`;
      const newTrack: Track = {
        id: trackId,
        title: item.title,
        artist: item.channelName,
        album: playlistData.title,
        audioUrl: item.videoId,
        coverUrl: item.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17',
        lyrics: '',
        source: 'youtube',
        youtubeId: item.videoId
      };
      addTrack(newTrack);
    });
    addToast(`Added ${playlistData.tracks.length} tracks to queue!`, "success");
  };

  const clearResults = () => {
    setQuery('');
    setResults(suggestions);
    setHasSearched(false);
  };

  return (
    <div className="flex-1 bg-neutral-900/40 rounded-3xl p-6 md:p-8 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left animate-fadeIn">
      
      {/* Upper Segment / Header Block */}
      <div className="flex-shrink-0 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500 animate-pulse shrink-0" />
            <span>YouTube Stream Engine</span>
          </h2>
          <p className="text-[10px] md:text-xs text-white/40 mt-1">
            {playlistData 
              ? `Currently viewing tracks from "${playlistData.title}"` 
              : "Search songs, paste a YouTube Playlist URL, or select from curated categories & playlists."
            }
          </p>
        </div>
      </div>

      {/* LOADING PLAYLIST PROGRESS COVER */}
      {playlistLoading && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center animate-fadeIn">
          <Loader2 className="h-10 w-10 animate-spin text-brand-purple mb-4" />
          <p className="text-sm font-bold text-white">Retrieving Playlist Tracks...</p>
          <p className="text-[11px] text-white/30 max-w-xs mt-1 leading-relaxed">
            Parsing list nodes from global api proxies. This process gathers tracks in high-fidelity list format.
          </p>
        </div>
      )}

      {/* PLAYLIST DETAIL VIEW */}
      {!playlistLoading && playlistData && (
        <div className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
          {/* Back button */}
          <div className="flex-shrink-0 mb-4">
            <button
              onClick={() => setPlaylistData(null)}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/90 hover:text-white rounded-xl text-xs font-bold border border-white/5 flex items-center gap-2 transition-all cursor-pointer shadow"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Browse</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-5 pb-6">
              {/* Playlist Info Header Card */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-left">
                  <div className="w-12 h-12 rounded-xl bg-brand-purple/15 flex items-center justify-center text-brand-purple shrink-0 border border-brand-purple/20">
                    <ListMusic className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-bold text-white tracking-tight">{playlistData.title}</h3>
                    <p className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1.5">
                      <span>by {playlistData.author}</span>
                      <span className="w-1 h-1 bg-white/20 rounded-full" />
                      <span className="text-brand-purple font-mono font-bold">{playlistData.videoCount} Tracks</span>
                    </p>
                  </div>
                </div>

                {/* Playlist level operations */}
                <div className="flex items-center gap-2 self-stretch md:self-auto">
                  <button
                    onClick={handlePlayAllPlaylist}
                    className="flex-1 md:flex-none py-2 px-4 bg-brand-purple hover:bg-brand-purple-light text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all duration-300"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>Play All</span>
                  </button>
                  <button
                    onClick={handleQueueAllPlaylist}
                    className="flex-1 md:flex-none py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/5 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all duration-300"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Queue All</span>
                  </button>
                </div>
              </div>

              {/* Playlist tracks vertical table view */}
              <div className="space-y-1.5 bg-white/[0.01] border border-white/5 rounded-2xl p-1 md:p-2 overflow-hidden">
                <div className="px-3.5 py-2 text-[9px] font-bold uppercase tracking-wider text-white/30 grid grid-cols-12 gap-2 border-b border-white/5">
                  <div className="col-span-1 text-center">#</div>
                  <div className="col-span-8 md:col-span-9 text-left">Title</div>
                  <div className="col-span-3 md:col-span-2 text-right">Duration / actions</div>
                </div>

                {playlistData.tracks.map((track, idx) => {
                  const isActive = currentTrackId === `youtube-${track.videoId}`;
                  return (
                    <div
                      key={`${track.videoId}-${idx}`}
                      onClick={() => handlePlayResult(track)}
                      className={`group px-3.5 py-2 rounded-xl grid grid-cols-12 gap-2 items-center cursor-pointer transition-all border ${
                        isActive
                          ? 'bg-brand-purple/15 border-brand-purple/35'
                          : 'bg-transparent hover:bg-white/[0.04] border-transparent hover:border-white/5'
                      }`}
                    >
                      {/* Index Indicator */}
                      <div className="col-span-1 text-center font-mono text-[11px] text-white/30 group-hover:text-brand-purple">
                        {isActive ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-purple inline-block animate-pulse" />
                        ) : (
                          idx + 1
                        )}
                      </div>

                      {/* Thumbnail + Details */}
                      <div className="col-span-8 md:col-span-9 flex items-center gap-3 overflow-hidden text-left">
                        <div className="relative shrink-0 w-8 h-8 rounded-lg overflow-hidden bg-black/40 border border-white/5">
                          <img
                            src={track.thumbnail}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="overflow-hidden">
                          <p className={`text-xs font-bold truncate ${isActive ? 'text-brand-purple' : 'text-white'}`}>
                            {track.title}
                          </p>
                          <p className="text-[10px] text-white/40 truncate mt-0.5">
                            {track.channelName}
                          </p>
                        </div>
                      </div>

                      {/* Duration + Compact Side Controls */}
                      <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-2 text-right">
                        <span className="text-[10px] font-mono text-white/30 pr-1 select-none hidden sm:inline-block">
                          {track.duration}
                        </span>
                        
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToQueue(track);
                            }}
                            className="p-1 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 cursor-pointer"
                            title="Add to queue"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSaveTrack(
                                `youtube-${track.videoId}`,
                                track.title,
                                track.channelName,
                                track.thumbnail,
                                track.videoId || ""
                              );
                            }}
                            className={`p-1 rounded-lg transition-all border cursor-pointer ${
                              tracks.some(t => t.id === `youtube-${track.videoId}` && t.isSaved)
                                ? 'text-brand-purple bg-brand-purple/10 border-brand-purple/20'
                                : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
                            }`}
                            title={tracks.some(t => t.id === `youtube-${track.videoId}` && t.isSaved) ? "Remove from list" : "Save to list"}
                          >
                            <Bookmark className={`h-3 w-3 ${tracks.some(t => t.id === `youtube-${track.videoId}` && t.isSaved) ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN SEARCH & BROWSE VIEWER */}
      {!playlistLoading && !playlistData && (
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Quick Categories Browse Suggestion Pills */}
          <div className="flex-shrink-0 mb-4 overflow-x-auto scrollbar-none flex items-center gap-2 py-1">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider shrink-0 mr-1">
              Quick Tags:
            </span>
            {quickTags.map((tag) => (
              <button
                key={tag.query}
                type="button"
                onClick={() => {
                  setQuery(tag.query);
                  handleSearch(undefined, tag.query);
                }}
                className="shrink-0 text-[10px] md:text-[11px] font-medium px-3 py-1.5 bg-white/5 hover:bg-brand-purple/20 hover:text-white rounded-full border border-white/5 hover:border-brand-purple/40 transition-all duration-300 cursor-pointer text-white/70"
              >
                {tag.label}
              </button>
            ))}
          </div>

          {/* Combined Smart Search & Playlist URL Input */}
          <form onSubmit={handleSearch} className="relative mb-5 flex-shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-white/40">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, artists OR paste YouTube Playlist URL here..."
                className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white placeholder-white/30 text-xs md:text-sm pl-11 pr-11 py-3 rounded-2xl border border-white/5 focus:border-brand-purple/40 focus:outline-none focus:ring-1 focus:ring-brand-purple/40 transition-all font-medium"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-brand-purple hover:bg-brand-purple-light text-white text-xs md:text-sm px-5 py-3 rounded-2xl flex items-center gap-2 font-bold cursor-pointer transition-all duration-300 disabled:opacity-50 shadow-lg shrink-0"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </button>
            
            {hasSearched && (
              <button
                type="button"
                onClick={clearResults}
                className="bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white text-xs px-3 py-3 rounded-2xl cursor-pointer transition-all duration-300"
                title="Return to Suggestions"
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Grid View Container */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-white/40">
                <Loader2 className="h-8 w-8 animate-spin text-brand-purple mb-4" />
                <p className="text-xs font-bold font-display uppercase tracking-widest text-brand-purple animate-pulse">Searching YouTube stream database...</p>
                <p className="text-[10px] text-white/25 mt-1">Racing multiple serverless proxy endpoints across the globe</p>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${hasSearched ? 'bg-brand-purple' : 'bg-red-500 animate-pulse'}`} />
                    <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50">
                      {hasSearched 
                        ? `Search Results (${results.length})` 
                        : `⚡ Recommended Streams & Playlists`
                      }
                    </h3>
                  </div>
                </div>

                {/* SQUARED CARDS RESPONSIVE GRID (Contains both playlist and video cards inline) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
                  
                  {/* INLINE CURATED PLAYLIST CARDS (Shown side-by-side with recommended videos) */}
                  {!hasSearched && suggestedPlaylists.map((playlist) => (
                    <div
                      key={playlist.playlistId}
                      onClick={() => handleLoadPlaylist(playlist.playlistId)}
                      className="group relative rounded-2xl overflow-hidden bg-brand-purple/5 hover:bg-brand-purple/15 border border-brand-purple/20 hover:border-brand-purple/40 transition-all duration-300 cursor-pointer flex flex-col shadow-md shadow-brand-purple/5"
                    >
                      {/* Image header with high opacity overlay */}
                      <div className="aspect-[16/10] w-full overflow-hidden relative bg-black/30">
                        <img
                          src={playlist.thumbnail}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                        />

                        {/* Hover Overlay with ListMusic icon */}
                        <div className="absolute inset-0 bg-brand-purple/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <span className="w-10 h-10 rounded-full bg-white text-brand-purple flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                            <ListMusic className="h-5 w-5" />
                          </span>
                        </div>

                        {/* Distinct badge stating Playlist */}
                        <div className="absolute top-2 left-2 bg-brand-purple text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1 border border-brand-purple/35 shadow-sm">
                          <ListMusic className="h-3 w-3 shrink-0" />
                          <span>Playlist</span>
                        </div>

                        {/* Tracks count indicator bottom-right */}
                        <span className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded-lg text-[9px] font-mono tracking-tighter text-white font-medium border border-white/5">
                          {playlist.videoCount} Tracks
                        </span>
                      </div>

                        {/* Content details */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="text-xs font-bold line-clamp-2 leading-snug tracking-tight text-white group-hover:text-brand-purple-light transition-colors text-left" title={playlist.title}>
                              {playlist.title}
                            </p>
                            <p className="text-[10px] text-white/45 truncate mt-1 text-left flex items-center gap-1">
                              <CheckCircle2 className="text-brand-purple h-3 w-3 shrink-0" />
                              <span>{playlist.channelName}</span>
                            </p>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoadPlaylist(playlist.playlistId);
                              }}
                              className="flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold bg-brand-purple/20 hover:bg-brand-purple text-white border border-brand-purple/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                            >
                              <ListMusic className="h-3.5 w-3.5" />
                              <span>View Tracks</span>
                            </button>
                          </div>
                        </div>
                    </div>
                  ))}

                  {/* REGULAR AND PLAYLIST RESULTS (MIXED INLINE) */}
                  {results.map((item) => {
                    if (item.isPlaylist) {
                      const pId = item.playlistId || "";
                      return (
                        <div
                          key={`playlist-${pId}`}
                          onClick={() => handleLoadPlaylist(pId)}
                          className="group relative rounded-2xl overflow-hidden bg-brand-purple/5 hover:bg-brand-purple/15 border border-brand-purple/20 hover:border-brand-purple/40 transition-all duration-300 cursor-pointer flex flex-col shadow-md shadow-brand-purple/5"
                        >
                          {/* Image header with high opacity overlay */}
                          <div className="aspect-[16/10] w-full overflow-hidden relative bg-black/30">
                            <img
                              src={item.thumbnail}
                              alt=""
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                            />

                            {/* Hover Overlay with ListMusic icon */}
                            <div className="absolute inset-0 bg-brand-purple/75 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <span className="w-10 h-10 rounded-full bg-white text-brand-purple flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                <ListMusic className="h-5 w-5" />
                              </span>
                            </div>

                            {/* Distinct badge stating Playlist */}
                            <div className="absolute top-2 left-2 bg-brand-purple text-white text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg flex items-center gap-1 border border-brand-purple/35 shadow-sm">
                              <ListMusic className="h-3 w-3 shrink-0" />
                              <span>Playlist</span>
                            </div>

                            {/* Tracks count indicator bottom-right */}
                            <span className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded-lg text-[9px] font-mono tracking-tighter text-white font-medium border border-white/5">
                              {item.videoCount || 0} Tracks
                            </span>
                          </div>

                          {/* Content details */}
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <div>
                              <p className="text-xs font-bold line-clamp-2 leading-snug tracking-tight text-white group-hover:text-brand-purple-light transition-colors text-left" title={item.title}>
                                {item.title}
                              </p>
                              <p className="text-[10px] text-white/45 truncate mt-1 text-left flex items-center gap-1">
                                <CheckCircle2 className="text-brand-purple h-3 w-3 shrink-0" />
                                <span>{item.channelName}</span>
                              </p>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoadPlaylist(pId);
                                }}
                                className="flex-1 py-1.5 px-2 rounded-xl text-[10px] font-bold bg-brand-purple/20 hover:bg-brand-purple text-white border border-brand-purple/30 transition-all cursor-pointer flex items-center justify-center gap-1"
                              >
                                <ListMusic className="h-3.5 w-3.5" />
                                <span>View Tracks</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isActive = currentTrackId === `youtube-${item.videoId}`;
                    return (
                      <div
                        key={`video-${item.videoId}`}
                        onClick={() => handlePlayResult(item)}
                        className={`group relative rounded-2xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.06] border transition-all duration-300 cursor-pointer flex flex-col ${
                          isActive 
                            ? 'border-brand-purple ring-1 ring-brand-purple/30 shadow-lg shadow-brand-purple-blob/10' 
                            : 'border-white/5 hover:border-white/15'
                        }`}
                      >
                        {/* Widescreen preview container */}
                        <div className="aspect-[16/10] w-full overflow-hidden relative bg-black/30">
                          <img
                            src={item.thumbnail}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                          />

                          {/* Dark overlay with floating play button */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <span className="w-10 h-10 rounded-full bg-brand-purple text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                              <Play className="h-5 w-5 fill-current ml-0.5" />
                            </span>
                          </div>

                          {/* Float Badge duration */}
                          <span className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded-lg text-[9px] font-mono tracking-tighter text-white font-medium border border-white/5">
                            {item.duration}
                          </span>

                          {/* Active state badge */}
                          {isActive && (
                            <div className="absolute top-2 left-2 bg-brand-purple px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-white flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              <span>LIVE</span>
                            </div>
                          )}
                        </div>

                        {/* Title details & action items */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <p 
                              className={`text-xs font-bold line-clamp-2 leading-snug tracking-tight text-left transition-colors duration-300 ${
                                isActive ? 'text-brand-purple' : 'text-white/90 group-hover:text-white'
                              }`}
                              title={item.title}
                            >
                              {item.title}
                            </p>
                            <p className="text-[10px] text-white/40 truncate flex items-center gap-1.5 mt-1.5 text-left">
                              <CheckCircle2 className="text-brand-purple h-3 w-3 shrink-0" />
                              <span>{item.channelName}</span>
                            </p>
                          </div>

                          {/* Compact Action Controls */}
                          <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSaveTrack(
                                  `youtube-${item.videoId}`,
                                  item.title,
                                  item.channelName,
                                  item.thumbnail,
                                  item.videoId || ""
                                );
                              }}
                              className={`flex-1 py-1.5 px-3 rounded-xl transition-all border cursor-pointer flex items-center justify-center gap-2 ${
                                tracks.some(t => t.id === `youtube-${item.videoId}` && t.isSaved)
                                  ? 'text-brand-purple bg-brand-purple/10 border-brand-purple/20'
                                  : 'text-white/50 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
                              }`}
                              title={tracks.some(t => t.id === `youtube-${item.videoId}` && t.isSaved) ? "Remove from Library" : "Save to Library"}
                            >
                              <Bookmark className={`h-3.5 w-3.5 ${tracks.some(t => t.id === `youtube-${item.videoId}` && t.isSaved) ? 'fill-current' : ''}`} />
                              <span className="text-[10px] font-bold">Save to Library</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToQueue(item);
                              }}
                              className="p-1.5 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 cursor-pointer flex items-center justify-center"
                              title="Add to queue"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-white/30">
                {loadingSuggestions ? (
                  <div className="flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-brand-purple" />
                    <p className="text-xs">Loading initial suggestions...</p>
                  </div>
                ) : hasSearched ? (
                  <>
                    <Frown className="h-10 w-10 mb-3 text-white/10" />
                    <p className="text-xs">No matching streams found</p>
                    <p className="text-[10px] text-white/20 mt-1">Try checking spelling or searching for a different track query.</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-4 p-3">
                      <Youtube className="h-8 w-8 text-white/20" />
                    </div>
                    <p className="text-xs font-medium">Search millions of songs instantly</p>
                    <p className="text-[10px] text-white/20 mt-1">Enter song keywords or video creators to start streaming.</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
