import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Track, YTMusicSong, YTMusicAlbum, YTMusicArtist, YTMusicSearchResults } from '../../types';
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
  Bookmark,
  Disc,
  Mic2,
  History,
  TrendingUp,
  ArrowRight,
  Star
} from 'lucide-react';

interface YouTubeSearchViewProps {
  onSelectTrack: (id: string) => void;
  currentTrackId: string | null;
  addTrack: (track: Track) => void;
  updateTrackLyrics: (id: string, lyrics: string) => void;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
  tracks: Track[];
  onToggleSave: (trackId: string, isSaved: boolean) => void;
}

type SearchTab = 'all' | 'songs' | 'albums' | 'artists';
type ViewMode = 'search' | 'album' | 'artist';

interface PlaylistData {
  playlistId: string;
  title: string;
  author: string;
  videoCount: number;
  tracks: YTMusicSong[];
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

export function YouTubeSearchView({
  onSelectTrack,
  currentTrackId,
  addTrack,
  addToast,
  tracks,
  onToggleSave
}: YouTubeSearchViewProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [results, setResults] = useState<YTMusicSearchResults | null>(null);
  const [suggestions, setSuggestions] = useState<YTMusicSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Detail Views State
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleToggleSaveTrack = (trackId: string, title: string, artist: string, thumbnail: string, videoId: string) => {
    const existingTrack = tracks.find(t => t.id === trackId);
    if (existingTrack) {
      const newSavedState = !existingTrack.isSaved;
      onToggleSave(trackId, newSavedState);
      if (newSavedState) {
        addToast(`Saved "${title}" to sidebar list!`, 'success');
      } else {
        addToast(`Removed "${title}" from sidebar list.`, 'info');
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
      addToast(`Saved "${title}" to sidebar list!`, 'success');
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

  const handleDownload = async (e: React.MouseEvent, item: YTMusicSong) => {
    e.stopPropagation();
    const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
    setDownloadingId(item.videoId);
    addToast(`Preparing download for "${item.title}"`, 'info');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoUrl,
          songTitle: item.title
        })
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.success && json.redirectUrl) {
          const a = document.createElement('a');
          a.href = json.redirectUrl;
          a.download = `${item.title || 'audio'}.mp3`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          addToast(`✅ Downloaded "${item.title}" successfully!`, 'success');
          return;
        } else if (json.error) {
          throw new Error(json.error);
        }
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.title || 'audio'}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      addToast(`✅ Downloaded "${item.title}" successfully!`, 'success');
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message ? `: ${error.message}` : '';
      addToast(`❌ Download failed. Please try again${errorMsg}`, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Quick exploration category tags for broad "free-search"
  const quickTags = [
    { label: '🔥 Today\'s Hits', query: 'Popular hit songs 2026 Billboard' },
    { label: '🕺 Dance & EDM', query: 'EDM festival music mix' },
    { label: '🎧 Pop Hits', query: 'pop hits mix popular songs' },
    { label: '✨ Chill Lo-Fi', query: 'lofi hip hop beats study chill' },
    { label: '🎸 Rock Classics', query: 'Rock classics hit songs' },
    { label: '✨ Acoustic Covers', query: 'Acoustic covers playlist' }
  ];

  const handleSearch = useCallback(async (searchQuery: string, tab: SearchTab) => {
    if (!searchQuery.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setHasSearched(true);
    setViewMode('search');

    try {
      const response = await fetch(`/api/ytmusic/search?q=${encodeURIComponent(searchQuery)}&filter=${tab === 'all' ? '' : tab.slice(0, -1)}`, {
        signal: abortController.signal
      });

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      
      if (data.success) {
        setResults(data.results);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Search error:', err);
        addToast('Search failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(query, activeTab);
      }, 400);
    } else {
      setResults(null);
      setHasSearched(false);
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, activeTab, handleSearch]);

  const fetchAlbumDetail = async (albumId: string) => {
    setDetailLoading(true);
    setViewMode('album');
    setDetailData(null);
    try {
      const res = await fetch(`/api/ytmusic/album/${albumId}`);
      const data = await res.json();
      if (data.success) {
        setDetailData(data.album);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Fetch album error:', err);
      addToast('Failed to load album details.', 'error');
      setViewMode('search');
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchArtistDetail = async (artistId: string) => {
    setDetailLoading(true);
    setViewMode('artist');
    setDetailData(null);
    try {
      const res = await fetch(`/api/ytmusic/artist/${artistId}`);
      const data = await res.json();
      if (data.success) {
        setDetailData(data.artist);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      console.error('Fetch artist error:', err);
      addToast('Failed to load artist details.', 'error');
      setViewMode('search');
    } finally {
      setDetailLoading(false);
    }
  };

  // Load trending suggestions on mount
  useEffect(() => {
    const fetchInitialSuggestions = async () => {
      try {
        const response = await fetch('/api/ytmusic/search?q=trending%20songs&filter=song');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.results.songs) {
            setSuggestions(data.results.songs);
          }
        }
      } catch (err) {
        console.warn("Could not load initial suggestions:", err);
      }
    };

    fetchInitialSuggestions();
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
            type: 'song',
            videoId: t.videoId,
            title: t.title,
            artist: t.channelName,
            thumbnail: t.thumbnail,
            duration: t.duration,
            isExplicit: false
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

  const handlePlayResult = async (item: YTMusicSong) => {
    const trackId = `youtube-${item.videoId}`;
    const newTrack: Track = {
      id: trackId,
      title: item.title,
      artist: item.artist,
      album: item.album || 'YouTube Music',
      audioUrl: item.videoId,
      coverUrl: item.thumbnail,
      lyrics: '',
      source: 'youtube',
      youtubeId: item.videoId,
      isExplicit: item.isExplicit
    };

    addTrack(newTrack);
    onSelectTrack(trackId);
    addToast(`Playing "${item.title}"!`, 'success');
  };

  const handleAddToQueue = (item: YTMusicSong) => {
    const trackId = `youtube-${item.videoId}`;
    const newTrack: Track = {
      id: trackId,
      title: item.title,
      artist: item.artist,
      album: item.album || 'YouTube Music',
      audioUrl: item.videoId,
      coverUrl: item.thumbnail,
      lyrics: '',
      source: 'youtube',
      youtubeId: item.videoId,
      isExplicit: item.isExplicit
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
        artist: item.artist,
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
        artist: item.artist,
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
                            {track.artist}
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
                                track.artist,
                                track.thumbnail,
                                track.videoId || ""
                              );
                            }}
                            className={`p-1 rounded-lg transition-all border cursor-pointer ${
                              tracks.some(t => t.id === `youtube-${track.videoId}` && t.isSaved)
                                ? 'text-brand-purple bg-brand-purple/10 border-brand-purple/20'
                                : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
                            }`}
                            title={tracks.some(t => t.id === `youtube-${track.videoId}` && t.isSaved) ? "Remove from sidebar" : "Save to sidebar"}
                          >
                            <Bookmark className={`h-3 w-3 ${tracks.some(t => t.id === `youtube-${track.videoId}` && t.isSaved) ? 'fill-current' : ''}`} />
                          </button>

                          <button
                            onClick={(e) => handleDownload(e, track)}
                            className="p-1 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5 cursor-pointer"
                            title="Download MP3"
                          >
                            <Download className="h-3 w-3" />
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
                  handleSearch(tag.query, activeTab);
                }}
                className="shrink-0 text-[10px] md:text-[11px] font-medium px-3 py-1.5 bg-white/5 hover:bg-brand-purple/20 hover:text-white rounded-full border border-white/5 hover:border-brand-purple/40 transition-all duration-300 cursor-pointer text-white/70"
              >
                {tag.label}
              </button>
            ))}
          </div>

          {/* Combined Smart Search & Playlist URL Input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const pId = extractPlaylistId(query);
              if (pId) {
                handleLoadPlaylist(pId);
              } else {
                handleSearch(query, activeTab);
              }
            }} 
            className="relative mb-5 flex-shrink-0 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-white/40">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs, albums, artists OR paste YouTube Playlist URL..."
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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

          {/* Search Tabs */}
          {hasSearched && (
            <div className="flex items-center gap-1 mb-4 flex-shrink-0">
              {(['all', 'songs', 'albums', 'artists'] as SearchTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-[10px] md:text-xs font-bold transition-all uppercase tracking-wider ${
                    activeTab === tab 
                      ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20' 
                      : 'bg-white/5 text-white/40 hover:text-white/60'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* Grid View Container */}
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-white/40">
                <Loader2 className="h-8 w-8 animate-spin text-brand-purple mb-4" />
                <p className="text-xs font-bold font-display uppercase tracking-widest text-brand-purple animate-pulse">Searching YouTube Music...</p>
                <p className="text-[10px] text-white/25 mt-1">Fetching metadata, songs, albums and artists</p>
              </div>
            ) : viewMode === 'album' && detailData ? (
              <div className="animate-fadeIn">
                <button 
                  onClick={() => setViewMode('search')}
                  className="mb-4 flex items-center gap-2 text-xs font-bold text-white/60 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to search
                </button>
                <div className="flex flex-col md:flex-row gap-6 mb-8">
                  <img src={detailData.thumbnail} className="w-48 h-48 rounded-2xl shadow-2xl" alt="" />
                  <div className="flex flex-col justify-end">
                    <p className="text-xs font-bold text-brand-purple uppercase tracking-widest mb-1">Album</p>
                    <h2 className="text-2xl md:text-4xl font-black text-white mb-2 leading-tight">{detailData.title}</h2>
                    <p className="text-sm text-white/60 font-medium">{detailData.artist} • {detailData.year}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {detailData.songs?.map((song: YTMusicSong, i: number) => (
                    <div 
                      key={song.videoId} 
                      onClick={() => handlePlayResult(song)}
                      className="group flex items-center gap-4 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className="w-4 text-xs font-mono text-white/20 text-center group-hover:text-brand-purple">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{song.title}</p>
                        <p className="text-[10px] text-white/40 truncate">{song.artist}</p>
                      </div>
                      <span className="text-[10px] font-mono text-white/20">{song.duration}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAddToQueue(song); }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-purple text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : viewMode === 'artist' && detailData ? (
              <div className="animate-fadeIn">
                <button 
                  onClick={() => setViewMode('search')}
                  className="mb-4 flex items-center gap-2 text-xs font-bold text-white/60 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to search
                </button>
                <div className="flex items-center gap-6 mb-8">
                  <img src={detailData.thumbnail} className="w-32 h-32 md:w-48 md:h-48 rounded-full shadow-2xl border-4 border-white/5" alt="" />
                  <div>
                    <h2 className="text-3xl md:text-5xl font-black text-white mb-2">{detailData.name}</h2>
                    <p className="text-xs font-bold text-brand-purple uppercase tracking-widest">Verified Artist</p>
                  </div>
                </div>
                
                {detailData.songs && detailData.songs.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Sparkles className="h-3 w-3" /> Popular Songs
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {detailData.songs.map((song: YTMusicSong) => (
                        <div key={song.videoId} onClick={() => handlePlayResult(song)} className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-white/5">
                          <img src={song.thumbnail} className="w-10 h-10 rounded-lg" alt="" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{song.title}</p>
                            <p className="text-[10px] text-white/40">{song.duration}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleAddToQueue(song); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-purple text-white opacity-0 group-hover:opacity-100 transition-all">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : results ? (
              <div className="space-y-8 pb-10">
                {/* SONGS SECTION */}
                {(activeTab === 'all' || activeTab === 'songs') && results.songs && results.songs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                        <Music className="h-3 w-3 text-brand-purple" /> Songs
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                      {results.songs.map((song) => {
                        const isActive = currentTrackId === `youtube-${song.videoId}`;
                        return (
                          <div
                            key={song.videoId}
                            onClick={() => handlePlayResult(song)}
                            className={`group flex items-center gap-3 p-2 rounded-xl border transition-all cursor-pointer ${
                              isActive 
                                ? 'bg-brand-purple/15 border-brand-purple/30' 
                                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] hover:border-white/15'
                            }`}
                          >
                            <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/5">
                              <img src={song.thumbnail} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Play className="h-4 w-4 text-white fill-current" />
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${isActive ? 'text-brand-purple' : 'text-white'}`}>{song.title}</p>
                              <p className="text-[10px] text-white/40 truncate mt-0.5">{song.artist}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-white/20 hidden sm:block">{song.duration}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleAddToQueue(song); }}
                                  className="p-1.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/5"
                                  title="Add to queue"
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSaveTrack(`youtube-${song.videoId}`, song.title, song.artist, song.thumbnail, song.videoId);
                                  }}
                                  className={`p-1.5 rounded-lg border ${
                                    tracks.some(t => t.id === `youtube-${song.videoId}` && t.isSaved)
                                      ? 'text-brand-purple border-brand-purple/20'
                                      : 'text-white/40 border-white/5'
                                  }`}
                                >
                                  <Bookmark className={`h-3 w-3 ${tracks.some(t => t.id === `youtube-${song.videoId}` && t.isSaved) ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ALBUMS SECTION */}
                {(activeTab === 'all' || activeTab === 'albums') && results.albums && results.albums.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Disc className="h-3 w-3 text-brand-purple" /> Albums
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {results.albums.map((album) => (
                        <div
                          key={album.albumId}
                          onClick={() => fetchAlbumDetail(album.albumId)}
                          className="group bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/15 p-3 rounded-2xl transition-all cursor-pointer"
                        >
                          <div className="aspect-square rounded-xl overflow-hidden mb-3 relative shadow-lg">
                            <img src={album.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            <div className="absolute inset-0 bg-brand-purple/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ListMusic className="h-6 w-6 text-white" />
                            </div>
                          </div>
                          <p className="text-xs font-bold text-white truncate leading-tight">{album.title}</p>
                          <p className="text-[10px] text-white/40 truncate mt-1">{album.artist} • {album.year}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ARTISTS SECTION */}
                {(activeTab === 'all' || activeTab === 'artists') && results.artists && results.artists.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Mic2 className="h-3 w-3 text-brand-purple" /> Artists
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {results.artists.map((artist) => (
                        <div
                          key={artist.artistId}
                          onClick={() => fetchArtistDetail(artist.artistId)}
                          className="group flex flex-col items-center p-3 rounded-2xl hover:bg-white/5 transition-all cursor-pointer text-center"
                        >
                          <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden mb-3 shadow-2xl border-2 border-white/5 group-hover:border-brand-purple/40 transition-colors">
                            <img src={artist.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          </div>
                          <p className="text-xs font-bold text-white truncate w-full">{artist.name}</p>
                          <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tighter">Artist</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center text-white/30">
                {loading ? (
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
