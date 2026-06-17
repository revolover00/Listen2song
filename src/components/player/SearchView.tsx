import React, { useState } from 'react';
import { Track } from '../../types';

interface SearchViewProps {
  tracks: Track[];
  onSelectTrack: (id: string) => void;
  currentTrackId: string | null;
  onDeleteTrack?: (id: string) => void;
}

export function SearchView({ tracks, onSelectTrack, currentTrackId, onDeleteTrack }: SearchViewProps) {
  const [query, setQuery] = useState('');

  const filtered = tracks.filter((track) => {
    const q = query.toLowerCase();
    return (
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      track.album.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 bg-neutral-900/40 rounded-3xl p-6 md:p-8 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left">
      {/* Search Input bar */}
      <div className="relative mb-6 flex-shrink-0">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-white/40">
          <i className="fa-solid fa-magnifying-glass text-sm" />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by track name, artist, or album..."
          className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/10 text-white placeholder-white/30 text-xs md:text-sm pl-11 pr-4 py-3 rounded-2xl border border-white/5 focus:border-brand-purple/40 focus:outline-none focus:ring-1 focus:ring-brand-purple/40 transition-all font-medium"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-white/40 hover:text-white cursor-pointer"
          >
            <i className="fa-solid fa-circle-xmark text-sm" />
          </button>
        )}
      </div>

      {/* Structured results stream */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-2 mb-3">
          Search Results ({filtered.length})
        </h3>
        {filtered.length > 0 ? (
          filtered.map((track, idx) => {
            const isActive = track.id === currentTrackId;
            return (
              <div
                key={`${track.id}-${idx}`}
                onClick={() => onSelectTrack(track.id)}
                className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group ${
                  isActive ? 'bg-brand-purple/10 border border-brand-purple/20' : 'hover:bg-white/5 bg-transparent'
                }`}
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="relative">
                    <img
                      src={track.coverUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                    {isActive && (
                      <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-brand-purple animate-ping" />
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden leading-normal">
                    <p className={`text-xs md:text-sm font-bold truncate ${isActive ? 'text-brand-purple' : 'text-white'}`}>
                      {track.title}
                    </p>
                    <p className="text-[10px] md:text-xs text-white/50 truncate">
                      {track.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/30 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-md border border-white/5 font-mono hidden sm:inline-block">
                    {track.album.split(' ').slice(0, 2).join(' ')}
                  </span>
                  {onDeleteTrack && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTrack(track.id);
                      }}
                      className="p-2 text-white/40 hover:text-red-500 hover:bg-white/10 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                      title="Remove song"
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  )}
                  <span className="text-white/40 group-hover:text-white transition-colors p-2">
                    <i className="fa-solid fa-circle-play text-sm text-brand-purple" />
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-white/30">
            <i className="fa-solid fa-face-frown text-3xl mb-3 text-white/20" />
            <p className="text-xs">No matching tracks found</p>
            <p className="text-[10px] text-white/20">Try searching for other words or upload more songs</p>
          </div>
        )}
      </div>
    </div>
  );
}
