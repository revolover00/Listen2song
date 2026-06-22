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
  Frown 
} from 'lucide-react';

interface YouTubeSearchViewProps {
  onSelectTrack: (id: string) => void;
  currentTrackId: string | null;
  addTrack: (track: Track) => void;
  updateTrackLyrics: (id: string, lyrics: string) => void;
  addToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

interface SearchResult {
  videoId: string;
  title: string;
  channelName: string;
  thumbnail: string;
  duration: string;
}

export function YouTubeSearchView({
  onSelectTrack,
  currentTrackId,
  addTrack,
  updateTrackLyrics,
  addToast
}: YouTubeSearchViewProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (e: React.MouseEvent, item: SearchResult) => {
    e.stopPropagation();
    const videoUrl = `https://www.youtube.com/watch?v=${item.videoId}`;
    setDownloadingId(item.videoId);
    addToast(`جاري تحضير الأغنية للتحميل... / Preparing download for "${item.title}"`, 'info');

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
          // If the server tells us to download directly (extremely reliable on Vercel/serverless)
          const a = document.createElement('a');
          a.href = json.redirectUrl;
          a.download = `${item.title || 'audio'}.mp3`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          addToast(`✅ تم تحميل "${item.title}" بنجاح! / Downloaded successfully!`, 'success');
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

      addToast(`✅ تم تحميل "${item.title}" بنجاح! / Downloaded successfully!`, 'success');
    } catch (error: any) {
      console.error(error);
      const errorMsg = error.message ? `: ${error.message}` : '';
      addToast(`❌ فشل تحميل الأغنية. الرجاء المحاولة مرة أخرى${errorMsg} / Download failed. Please try again.`, 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Quick exploration category tags for broad "free-search" ("بحث بحرية")
  const quickTags = [
    { label: '🔥 Today\'s Hits', query: 'Popular hit songs 2026 Billboard' },
    { label: '🕺 Dance & EDM', query: 'EDM festival music mix' },
    { label: '🎧 Pop Hits', query: 'pop hits mix popular songs' },
    { label: '✨ Chill Lo-Fi', query: 'lofi hip hop beats study chill' },
    { label: '🎸 Rock Classics', query: 'Rock classics hit songs' },
    { label: '✨ Acoustic Covers', query: 'Acoustic covers playlist' }
  ];

  const cleanVideoTitleForLyrics = (rawTitle: string): string => {
    return rawTitle
      .replace(/\s*[\(\[].*?[\)\]]\s*/gi, '') // Strip (Official Video), [Lyrics], etc.
      .replace(/ft\./gi, '')
      .replace(/feat\./gi, '')
      .replace(/official\s+audio/gi, '')
      .replace(/official\s+video/gi, '')
      .replace(/video\s+clip/gi, '')
      .replace(/lyric\s+video/gi, '')
      .trim();
  };

  // Load trending suggestions on mount
  React.useEffect(() => {
    let active = true;
    const fetchInitialSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const defaultQueries = ["Popular hit songs 2026", "Billboard Hot 100 songs", "Viral acoustic hits current"];
        const randomQuery = defaultQueries[Math.floor(Math.random() * defaultQueries.length)];
        
        let searchResults: SearchResult[] = [];
        
        // 1. Try CDN first
        const ytSearch = (window as any).ytSearch;
        if (typeof ytSearch === 'function') {
          try {
            console.log("[YouTubeView] Pre-loading suggestions via CDN for:", randomQuery);
            const raw = await ytSearch(randomQuery);
            if (Array.isArray(raw) && raw.length > 0) {
              searchResults = raw.map((item: any) => ({
                videoId: item.videoId || item.id,
                title: item.title || item.name || "Unknown title",
                channelName: item.author?.name || item.channelName || item.channel || "Unknown Channel",
                thumbnail: item.thumbnail || item.image || item.thumbnails?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17",
                duration: item.duration || item.timestamp || "0:00"
              }));
            }
          } catch (err) {
            console.warn("[YouTubeView] CDN suggestion load failed, falling back.");
          }
        }

        // 2. Fallback to server scraper
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
        console.warn("Failed loading initial suggestions:", err);
      } finally {
        if (active) setLoadingSuggestions(false);
      }
    };

    fetchInitialSuggestions();
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const activeQuery = customQuery !== undefined ? customQuery : query;
    if (!activeQuery.trim()) return;

    if (customQuery !== undefined) {
      setQuery(customQuery);
    }

    setLoading(true);
    setHasSearched(true);
    try {
      let searchResults: SearchResult[] = [];
      
      // 1. Try invoking the CDN ytSearch library if present
      const ytSearch = (window as any).ytSearch;
      if (typeof ytSearch === 'function') {
        try {
          console.log("[YouTubeView] Querying ytSearch via CDN for:", activeQuery);
          const raw = await ytSearch(activeQuery);
          if (Array.isArray(raw) && raw.length > 0) {
            searchResults = raw.map((item: any) => ({
              videoId: item.videoId || item.id,
              title: item.title || item.name || "Unknown title",
              channelName: item.author?.name || item.channelName || item.channel || "Unknown Channel",
              thumbnail: item.thumbnail || item.image || item.thumbnails?.[0]?.url || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17",
              duration: item.duration || item.timestamp || "0:00"
            }));
          }
        } catch (err) {
          console.warn("[YouTubeView] CDN search failed. Falling back to backend parser.");
        }
      }

      // 2. If CDN results are empty or the method failed, call our robust Express scraper fallback
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
        addToast("No tracks found for this search. Try other keywords. / لا توجد نتائج للبحث", "info");
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

    // Add track into playlist store
    addTrack(newTrack);
    // Instantly select playing track
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
    addToast(`Added "${item.title}" to queue / قائمة التشغيل`, 'success');
  };

  const clearResults = () => {
    setQuery('');
    setResults(suggestions);
    setHasSearched(false);
  };

  return (
    <div className="flex-1 bg-neutral-900/40 rounded-3xl p-6 md:p-8 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left animate-fadeIn">
      
      {/* Title block */}
      <div className="flex-shrink-0 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm md:text-base font-bold tracking-tight text-white flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500 animate-pulse" />
            YouTube Search / بحث يوتيوب بحرية
          </h2>
          <p className="text-[10px] md:text-xs text-white/40 mt-1">
            Search and stream any song straight from YouTube directly. No boundaries or strict keywords.
          </p>
        </div>
        {hasSearched && (
          <button
            onClick={clearResults}
            className="text-[10px] font-bold text-white/50 hover:text-white px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 cursor-pointer ease-in-out duration-300"
          >
            ← Return to suggested / رجوع للمقترحة
          </button>
        )}
      </div>

      {/* Modern category browse suggestion pills */}
      <div className="flex-shrink-0 mb-4 overflow-x-auto scrollbar-none flex items-center gap-2 py-1">
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider shrink-0 mr-1">
          Explore / تصفح سريع:
        </span>
        {quickTags.map((tag) => (
          <button
            key={tag.query}
            type="button"
            onClick={() => handleSearch(undefined, tag.query)}
            className="shrink-0 text-[10px] md:text-[11px] font-medium px-3 py-1.5 bg-white/5 hover:bg-brand-purple/20 hover:text-white rounded-full border border-white/5 hover:border-brand-purple/40 transition-all duration-300 cursor-pointer text-white/70"
          >
            {tag.label}
          </button>
        ))}
      </div>

      {/* Search form controls */}
      <form onSubmit={handleSearch} className="relative mb-5 flex-shrink-0 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-white/40">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search matching songs, artists or channels on YouTube... (ابحث عن أي أغنية أو كليب)"
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
          className="bg-brand-purple hover:bg-brand-purple-light text-white text-xs md:text-sm px-5 py-3 rounded-2xl flex items-center gap-2 font-bold cursor-pointer transition-all duration-300 disabled:opacity-50 shadow-lg shadow-brand-purple-blob/15 shrink-0"
        >
          <Search className="h-4 w-4" />
          Search / بحث
        </button>
      </form>

      {/* Grid or stream results */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-white/40">
            <Loader2 className="h-8 w-8 animate-spin text-brand-purple mb-4" />
            <p className="text-xs font-bold font-display uppercase tracking-widest text-brand-purple animate-pulse">Searching YouTube stream database...</p>
            <p className="text-[10px] text-white/25 mt-1">This will only take a couple of seconds</p>
          </div>
        ) : results.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-3 px-2">
              <span className={`w-2 h-2 rounded-full ${hasSearched ? 'bg-brand-purple' : 'bg-red-500 animate-pulse'}`} />
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                {hasSearched 
                  ? `Search Results / نتائج البحث (${results.length})` 
                  : `⚡ Suggested Trending Videos / الفيديوهات المقترحة والتريند الآن`
                }
              </h3>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {results.map((item) => {
                const isActive = currentTrackId === `youtube-${item.videoId}`;
                return (
                  <div
                    key={item.videoId}
                    onClick={() => handlePlayResult(item)}
                    className={`flex items-center justify-between p-2.5 md:p-3 rounded-2xl transition-all cursor-pointer group border ${
                      isActive 
                        ? 'bg-brand-purple/15 border-brand-purple/35' 
                        : 'bg-white/[0.01] hover:bg-white/[0.06] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 overflow-hidden">
                      {/* Image Preview */}
                      <div className="relative shrink-0">
                        <img
                          src={item.thumbnail}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover border border-white/5 shadow-md shadow-black/40 group-hover:scale-[1.03] transition-transform duration-300"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 rounded text-[8px] font-mono tracking-tighter text-white/90">
                          {item.duration}
                        </span>
                        {isActive && (
                          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                            <span className="w-2.5 h-2.5 rounded-full bg-brand-purple animate-ping" />
                          </div>
                        )}
                      </div>

                      {/* Video Title and Channel info */}
                      <div className="overflow-hidden leading-normal text-left">
                        <p className={`text-xs md:text-sm font-bold truncate leading-snug group-hover:text-brand-purple transition-colors duration-300 ${
                          isActive ? 'text-brand-purple' : 'text-white'
                        }`} title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-[10px] md:text-xs text-white/40 truncate flex items-center gap-1.5 mt-1">
                          <CheckCircle2 className="text-brand-purple h-3.5 w-3.5" />
                          {item.channelName}
                        </p>
                      </div>
                    </div>

                    {/* Interaction Buttons */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {/* Download Button */}
                      <button
                        onClick={(e) => handleDownload(e, item)}
                        disabled={downloadingId !== null}
                        className={`p-2 lg:p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center border ${
                          downloadingId === item.videoId
                            ? 'text-brand-purple bg-brand-purple/10 border-brand-purple/20 animate-pulse'
                            : 'text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
                        }`}
                        title={
                          downloadingId === item.videoId
                            ? "جاري التحميل... / Downloading..."
                            : "تحميل الأغنية MP3 / Download MP3"
                        }
                      >
                        {downloadingId === item.videoId ? (
                          <Loader2 className="h-4 w-4 animate-spin text-brand-purple" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </button>

                      {/* Add to Queue Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToQueue(item);
                        }}
                        className="p-2 lg:p-2.5 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-white/5"
                        title="Add to queue / إضافة للانتظار"
                      >
                        <Plus className="h-4 w-4" />
                      </button>

                      {/* Single Action Play button */}
                      <span className="w-8 h-8 md:w-9.5 md:h-9.5 rounded-xl bg-brand-purple/10 border border-brand-purple/20 text-brand-purple flex items-center justify-center group-hover:bg-brand-purple group-hover:text-white transition-all duration-500 scale-[0.95] group-hover:scale-100 p-2">
                        <Play className="h-4 w-4 ml-0.5 fill-current" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-white/30">
            {loadingSuggestions ? (
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin mb-3 text-brand-purple" />
                <p className="text-xs">Loading initial suggestions...</p>
              </div>
            ) : hasSearched ? (
              <>
                <Frown className="h-10 w-10 mb-3 text-white/10" />
                <p className="text-xs">No matching streams found</p>
                <p className="text-[10px] text-white/20 mt-1">Try check spelling or searching for a different track query.</p>
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
  );
}
