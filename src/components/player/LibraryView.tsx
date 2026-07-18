import React, { useState } from 'react';
import { Track } from '../../types';
import { 
  Music, 
  Disc, 
  User, 
  Shuffle, 
  Volume2, 
  Play, 
  Pencil, 
  Trash2, 
  ArrowLeft, 
  ChevronRight 
} from 'lucide-react';

interface LibraryViewProps {
  tracks: Track[];
  viewType: 'albums' | 'artists' | 'mix' | 'songs';
  setViewType: (view: 'albums' | 'artists' | 'mix' | 'songs') => void;
  onSelectTrack: (id: string) => void;
  currentTrackId: string | null;
  onDeleteTrack?: (id: string) => void;
  onEditTrack?: (track: Track) => void;
}

export function LibraryView({
  tracks,
  viewType,
  setViewType,
  onSelectTrack,
  currentTrackId,
  onDeleteTrack,
  onEditTrack
}: LibraryViewProps) {
  
  // Local state for expanded items
  const [expandedAlbum, setExpandedAlbum] = useState<string | null>(null);
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);

  // Dynamic Grouping for Albums
  const groupedAlbums = React.useMemo(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach((t) => {
      const album = t.album || 'Unknown Album';
      if (!map.has(album)) map.set(album, []);
      map.get(album)!.push(t);
    });
    return Array.from(map.entries());
  }, [tracks]);

  // Dynamic Grouping for Artists
  const groupedArtists = React.useMemo(() => {
    const map = new Map<string, Track[]>();
    tracks.forEach((t) => {
      const artist = t.artist || 'Unknown Artist';
      if (!map.has(artist)) map.set(artist, []);
      map.get(artist)!.push(t);
    });
    return Array.from(map.entries());
  }, [tracks]);

  const renderTabsHeader = () => (
    <div className="flex-shrink-0 flex items-center gap-1.5 p-1 bg-black/45 rounded-2xl border border-white/5 mb-5 overflow-x-auto scrollbar-none">
      {(['songs', 'albums', 'artists', 'mix'] as const).map((tab) => {
        const isSelected = viewType === tab;
        return (
          <button
            key={tab}
            onClick={() => {
              setViewType(tab);
              setExpandedAlbum(null);
              setExpandedArtist(null);
            }}
            className={`cursor-pointer px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 select-none ${
              isSelected
                ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'songs' && <Music className="h-3.5 w-3.5" />}
            {tab === 'albums' && <Disc className="h-3.5 w-3.5" />}
            {tab === 'artists' && <User className="h-3.5 w-3.5" />}
            {tab === 'mix' && <Shuffle className="h-3.5 w-3.5" />}
            <span>
              {tab === 'songs' ? 'Songs' : tab === 'albums' ? 'Albums' : tab === 'artists' ? 'Artists' : 'Mix'}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderTrackItem = (track: Track, idx: number) => {
    const isActive = track.id === currentTrackId;
    return (
      <div
        key={`${track.id}-${idx}`}
        className={`group/item flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
          isActive
            ? 'bg-brand-purple/10 border-brand-purple/35 shadow-[0_0_15px_rgba(var(--brand-purple),0.1)]'
            : 'bg-black/10 border-white/5 hover:bg-white/5 hover:border-white/10'
        }`}
      >
        <div
          onClick={() => onSelectTrack(track.id)}
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        >
          <div className="relative shrink-0">
            <img
              src={track.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover border border-white/5"
            />
            {isActive && (
              <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-brand-purple animate-ping" />
              </div>
            )}
          </div>
          <div className="overflow-hidden text-left leading-normal flex-1">
            <h4 className={`text-xs font-bold truncate ${isActive ? 'text-brand-purple' : 'text-white'} flex items-center gap-1.5`}>
              <span className="text-[9px] opacity-75 shrink-0" title={track.source === 'youtube' || track.id.startsWith('youtube-') ? "YouTube" : "Local"}>
                {track.source === 'youtube' || track.id.startsWith('youtube-') ? '🎬' : '📁'}
              </span>
              <span className="truncate">{track.title}</span>
            </h4>
            <p className="text-[10px] text-white/50 truncate">
              {track.artist} • <span className="italic">{track.album}</span>
            </p>
          </div>
        </div>

        {/* Track Actions */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Play Icon */}
          <button
            onClick={() => onSelectTrack(track.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-brand-purple/20 text-white/70 hover:text-white transition-all cursor-pointer text-[10px]"
            title="Play Song"
          >
            {isActive ? (
              <Volume2 className="h-3.5 w-3.5 text-brand-purple animate-pulse" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
          </button>

          {/* Edit Button */}
          {onEditTrack && (
            <button
              onClick={() => onEditTrack(track)}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-brand-purple/20 text-white/50 hover:text-brand-purple transition-all cursor-pointer text-[10px]"
              title="Edit Title"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Delete Button */}
          {onDeleteTrack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${track.title}"?`)) {
                  onDeleteTrack(track.id);
                }
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-500 transition-all cursor-pointer text-[10px]"
              title="Delete Song"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // View 1: ALL Songs Tab
  if (viewType === 'songs') {
    return (
      <div className="flex-1 bg-neutral-900/40 rounded-3xl p-4 md:p-6 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left">
        {renderTabsHeader()}

        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8A8A8A] mb-3 px-1 flex-shrink-0 flex items-center justify-between">
          <span>All Songs ({tracks.length})</span>
          <span className="text-[9px] text-[#8A8A8A]/60 italic font-mono lowercase">Manage tracks library</span>
        </h3>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {tracks.length > 0 ? (
            tracks.map(renderTrackItem)
          ) : (
            <div className="text-center py-12 text-white/30 italic text-xs">
              No tracks found in library
            </div>
          )}
        </div>
      </div>
    );
  }

  // View 2: Detailed Album list
  if (viewType === 'albums' && expandedAlbum) {
    const albumTracks = tracks.filter((t) => (t.album || 'Unknown Album') === expandedAlbum);
    return (
      <div className="flex-1 bg-neutral-900/40 rounded-3xl p-4 md:p-6 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left animate-fadeIn">
        <div className="flex items-center justify-between mb-4 flex-shrink-0 border-b border-white/5 pb-2">
          <button
            onClick={() => setExpandedAlbum(null)}
            className="cursor-pointer flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-brand-purple hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Albums
          </button>
          <span className="text-[10px] text-white/60 font-semibold truncate max-w-[180px] bg-brand-purple/15 px-2.5 py-1 rounded-lg border border-brand-purple/10 flex items-center gap-1.5">
            <Disc className="h-3 w-3 text-brand-purple shrink-0" /> {expandedAlbum}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {albumTracks.length > 0 ? (
            albumTracks.map(renderTrackItem)
          ) : (
            <div className="text-center py-8 text-white/30 text-xs">No tracks in this album</div>
          )}
        </div>
      </div>
    );
  }

  // View 3: Album Cards Layout
  if (viewType === 'albums') {
    return (
      <div className="flex-1 bg-neutral-900/40 rounded-3xl p-4 md:p-6 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left">
        {renderTabsHeader()}

        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8A8A8A] mb-4 px-1 flex-shrink-0 flex items-center gap-2">
          <Disc className="h-4 w-4 text-brand-purple shrink-0" /> Collection Albums ({groupedAlbums.length})
        </h3>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3.5" style={{ alignContent: 'start' }}>
          {groupedAlbums.map(([albumName, albumTracks]) => {
            const representativeTrack = albumTracks[0] || { coverUrl: 'https://picsum.photos/400/400', artist: 'Unknown' };
            return (
              <div
                key={albumName}
                onClick={() => setExpandedAlbum(albumName)}
                className="bg-black/20 hover:bg-brand-purple/5 p-3 rounded-2xl border border-white/5 hover:border-brand-purple/20 transition-all text-left flex flex-col justify-between group/album-card cursor-pointer select-none"
              >
                <div className="relative mb-3 aspect-square rounded-xl overflow-hidden shadow-md">
                  <img
                    src={representativeTrack.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover/album-card:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/80 px-2 rounded text-[9px] font-black uppercase text-brand-purple">
                    {albumTracks.length} song{albumTracks.length > 1 ? 's' : ''}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-1 group-hover/album-card:text-brand-purple transition-colors">{albumName}</h4>
                  <p className="text-[10px] text-white/50 truncate mb-2">{representativeTrack.artist}</p>
                </div>
                <div className="text-[9px] uppercase font-bold tracking-wider text-brand-purple flex items-center gap-1 group-hover/album-card:translate-x-1 transition-transform">
                  View Tracks <ChevronRight className="h-3 w-3" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // View 4: Detailed Artist lists
  if (viewType === 'artists' && expandedArtist) {
    const artistTracks = tracks.filter((t) => (t.artist || 'Unknown Artist') === expandedArtist);
    return (
      <div className="flex-1 bg-neutral-900/40 rounded-3xl p-4 md:p-6 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left animate-fadeIn">
        <div className="flex items-center justify-between mb-4 flex-shrink-0 border-b border-white/5 pb-2">
          <button
            onClick={() => setExpandedArtist(null)}
            className="cursor-pointer flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-brand-purple hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Artists
          </button>
          <span className="text-[10px] text-white/60 font-semibold truncate max-w-[180px] bg-brand-purple/15 px-2.5 py-1 rounded-lg border border-brand-purple/10 flex items-center gap-1.5">
            <User className="h-3 w-3 text-brand-purple shrink-0" /> {expandedArtist}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {artistTracks.length > 0 ? (
            artistTracks.map(renderTrackItem)
          ) : (
            <div className="text-center py-8 text-white/30 text-xs">No tracks for this artist</div>
          )}
        </div>
      </div>
    );
  }

  // View 5: Artists Circles Layout
  if (viewType === 'artists') {
    return (
      <div className="flex-1 bg-neutral-900/40 rounded-3xl p-4 md:p-6 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left">
        {renderTabsHeader()}

        <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8A8A8A] mb-4 px-1 flex-shrink-0 flex items-center gap-2">
          <Music className="h-4 w-4 text-brand-purple shrink-0" /> Curated Artists ({groupedArtists.length})
        </h3>

        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-3.5" style={{ alignContent: 'start' }}>
          {groupedArtists.map(([artistName, artistTracks]) => {
            const repTrack = artistTracks[0] || { coverUrl: 'https://picsum.photos/400/400' };
            return (
              <div
                key={artistName}
                onClick={() => setExpandedArtist(artistName)}
                className="bg-black/20 hover:bg-brand-purple/5 p-4 rounded-2xl border border-white/5 hover:border-brand-purple/20 transition-all flex flex-col items-center text-center justify-between group/artist-card cursor-pointer select-none"
              >
                <div className="relative mb-3 w-16 h-16 rounded-full overflow-hidden shadow-lg border border-brand-purple/20 group-hover/artist-card:scale-105 transition-transform duration-300">
                  <img
                    src={repTrack.coverUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mb-2">
                  <h4 className="text-xs font-bold text-white truncate max-w-[120px] group-hover/artist-card:text-brand-purple transition-colors">{artistName}</h4>
                  <p className="text-[9px] text-[#A0A0A0] uppercase tracking-wider">{artistTracks.length} Track{artistTracks.length > 1 ? 's' : ''}</p>
                </div>
                <button
                  type="button"
                  className="cursor-pointer bg-brand-purple/10 group-hover/artist-card:bg-brand-purple text-brand-purple group-hover/artist-card:text-white text-[9px] font-bold uppercase py-1.5 px-3 rounded-lg transition-all border border-brand-purple/20"
                >
                  View Tracks
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // View 6: Mix Center Tab
  return (
    <div className="flex-1 bg-neutral-900/40 rounded-3xl p-4 md:p-6 flex flex-col h-[350px] md:h-full min-h-[300px] border border-white/5 overflow-hidden text-left animate-fadeIn">
      {renderTabsHeader()}

      <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8A8A8A] mb-4 px-1 flex-shrink-0 flex items-center gap-2">
        <Shuffle className="h-4 w-4 text-brand-purple shrink-0" /> PALESTRA MIX CENTER
      </h3>

      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center select-none">
        <div className="w-40 h-24 bg-gradient-to-br from-indigo-950 to-brand-purple-dark rounded-2xl relative border border-white/10 flex items-center justify-center shadow-xl mb-4 group hover:scale-[1.02] hover:shadow-brand-purple/10 transition-all duration-300">
          <div className="flex items-center gap-6">
            <div className="w-8 h-8 rounded-full border-4 border-dashed border-white/40 animate-spin-slow flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white/60" />
            </div>
            <div className="w-8 h-8 rounded-full border-4 border-dashed border-white/40 animate-spin-slow flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-white/60" />
            </div>
          </div>
          <span className="absolute bottom-2 left-3 text-[7px] font-mono tracking-widest text-white/50">EQ-CENTER A-SIDE</span>
        </div>

        <h4 className="text-sm font-bold text-white mb-2">Infinite Generation Loop</h4>
        <p className="text-xs text-white/40 max-w-sm mb-4 leading-relaxed">
          Tired of selecting? Activate the Palestra Mix engine to run intelligent random blending, transition offsets, and randomized track sequencing.
        </p>

        <button
          onClick={() => {
            if (tracks.length > 0) {
              const randomized = tracks[Math.floor(Math.random() * tracks.length)];
              onSelectTrack(randomized.id);
            }
          }}
          className="cursor-pointer bg-brand-purple hover:bg-brand-purple-dark text-white text-[10px] uppercase font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg active:scale-95"
        >
          Generate Absolute Shuffle
        </button>
      </div>
    </div>
  );
}
