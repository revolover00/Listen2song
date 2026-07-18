import React, { useState } from 'react';
import { Track } from '../../types';
import { Search, X, Pencil, Trash2, Youtube, Music } from 'lucide-react';

interface SidebarProps {
  tracks: Track[];
  currentTrackId: string | null;
  onSelectTrack: (id: string) => void;
  onDeleteTrack?: (id: string) => void;
  onEditTrack: (track: Track) => void;
}

export function Sidebar({
  tracks,
  currentTrackId,
  onSelectTrack,
  onDeleteTrack,
  onEditTrack
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Sifting and filtering the tracks relative to user search query
  const shownTracks = React.useMemo(() => {
    return tracks.filter((t) => {
      // Exclude demo tracks entirely from sidebar as per user request
      const isDemo = t.isDemo === true || t.id.startsWith('demo-');
      if (isDemo) return false;

      const isYt = t.source === 'youtube' || t.id.startsWith('youtube-');
      if (isYt) {
        return t.isSaved === true;
      }
      return true;
    });
  }, [tracks]);

  const filteredTracks = React.useMemo(() => {
    if (!searchQuery.trim()) return shownTracks;
    const q = searchQuery.toLowerCase();
    return shownTracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        (t.album && t.album.toLowerCase().includes(q))
    );
  }, [shownTracks, searchQuery]);

  return (
    <div className="w-64 md:w-68 bg-[#121212]/35 backdrop-blur-3xl p-4 flex flex-col border-r border-white/5 h-full overflow-hidden select-none">
      
      {/* Top Section */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-purple animate-pulse shadow-[0_0_10px_var(--brand-purple)]" />
            <h3 className="font-display font-black text-[10px] tracking-[0.2em] text-white/85 uppercase">
              Tracks Library
            </h3>
          </div>
          <span className="text-[9px] font-mono font-bold text-brand-purple bg-brand-purple/10 px-2 py-0.5 rounded-full">
            {shownTracks.length} items
          </span>
        </div>

        {/* Quick Search */}
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-white/40">
            <Search className="h-3 w-3" />
          </span>
          <input
            type="text"
            placeholder="Search within library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/5 focus:border-brand-purple/40 rounded-xl pl-8.5 pr-8 py-2 text-[10px] text-white placeholder-white/30 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-2.5 flex items-center text-white/40 hover:text-white transition-all cursor-pointer p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Main stacked vertical Songs list */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
        {filteredTracks.map((track, idx) => {
          const isActive = track.id === currentTrackId;
          return (
            <div
              key={`${track.id}-${idx}`}
              className={`group/track flex items-center justify-between p-2 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-brand-purple/10 border-brand-purple/30 shadow-[0_4px_15px_rgba(var(--brand-purple),0.05)]'
                  : 'bg-black/10 border-white/5 hover:bg-white/5 hover:border-white/10'
              }`}
            >
              {/* Cover & metadata */}
              <div
                onClick={() => onSelectTrack(track.id)}
                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
              >
                <div className="relative shrink-0">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-xl object-cover border border-white/5"
                  />
                  {isActive && (
                    <div className="absolute inset-0 bg-black/45 rounded-xl flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-ping" />
                    </div>
                  )}
                </div>
                <div className="overflow-hidden text-left leading-normal flex-1">
                  <p className={`text-[11.5px] font-bold truncate ${isActive ? 'text-brand-purple' : 'text-white'} flex items-center gap-1.5`}>
                    <span className="opacity-75 shrink-0" title={track.source === 'youtube' || track.id.startsWith('youtube-') ? "YouTube" : "Local"}>
                      {track.source === 'youtube' || track.id.startsWith('youtube-') ? (
                        <Youtube className="h-3.5 w-3.5 text-red-500" />
                      ) : (
                        <Music className="h-3.5 w-3.5 text-brand-purple" />
                      )}
                    </span>
                    <span className="truncate">{track.title}</span>
                  </p>
                  <p className="text-[9.5px] text-white/50 truncate">
                    {track.artist}
                  </p>
                </div>
              </div>

              {/* Quick contextual actions */}
              <div className="flex items-center gap-1 opacity-100 md:opacity-30 group-hover/track:opacity-100 transition-opacity shrink-0 ml-1.5">
                <button
                  onClick={() => onEditTrack(track)}
                  className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5 hover:bg-brand-purple/20 text-white/60 hover:text-brand-purple transition-all cursor-pointer p-1"
                  title="Rename title"
                >
                  <Pencil className="h-3 w-3" />
                </button>

                {onDeleteTrack && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Are you sure you want to delete "${track.title}"?`
                        )
                      ) {
                        onDeleteTrack(track.id);
                      }
                    }}
                    className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all cursor-pointer p-1"
                    title="Delete track"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredTracks.length === 0 && (
          <div className="text-center py-10 text-white/30 italic text-[11px] select-none">
            No tracks found
          </div>
        )}
      </div>

    </div>
  );
}
