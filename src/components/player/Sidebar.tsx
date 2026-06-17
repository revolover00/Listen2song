import React, { useState } from 'react';
import { Track, Playlist } from '../../types';

interface SidebarProps {
  tracks: Track[];
  currentTrackId: string | null;
  onSelectTrack: (id: string) => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
  onDeleteTrack?: (id: string) => void;
  // Playlist enhancements (تغيير اسامي البلاي ليست واضافه اغاني لها)
  playlists: Playlist[];
  activePlaylistId: string | null;
  setActivePlaylistId: (id: string | null) => void;
  onCreatePlaylist: (name: string) => void;
  onRenamePlaylist: (id: string, name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onEditTrack: (track: Track) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
}

export function Sidebar({
  tracks,
  currentTrackId,
  onSelectTrack,
  activeSection,
  setActiveSection,
  onDeleteTrack,
  playlists,
  activePlaylistId,
  setActivePlaylistId,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onEditTrack,
  onAddTrackToPlaylist
}: SidebarProps) {
  
  const [showCreatePl, setShowCreatePl] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const [renamingPlId, setRenamingPlId] = useState<string | null>(null);
  const [renamingPlName, setRenamingPlName] = useState('');

  const navItems = [
    { id: 'home', label: 'Home', icon: 'fa-house' },
    { id: 'search', label: 'Search', icon: 'fa-magnifying-glass' },
    { id: 'songs', label: 'Songs', icon: 'fa-music' },
    { id: 'albums', label: 'Albums', icon: 'fa-compact-disc' },
    { id: 'artists', label: 'Artists', icon: 'fa-user-astronaut' },
    { id: 'mix', label: 'Mix', icon: 'fa-shuffle' },
  ];

  // Filter visible tracks based on active playlist selection
  const filteredTracks = React.useMemo(() => {
    if (!activePlaylistId) return tracks;
    const playlist = playlists.find(p => p.id === activePlaylistId);
    if (!playlist) return tracks;
    return tracks.filter(t => playlist.trackIds.includes(t.id));
  }, [tracks, playlists, activePlaylistId]);

  const handleCreatePlaylistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlName.trim()) {
      onCreatePlaylist(newPlName.trim());
      setNewPlName('');
      setShowCreatePl(false);
    }
  };

  const startRenamePlaylist = (pl: Playlist, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingPlId(pl.id);
    setRenamingPlName(pl.name);
  };

  const handleRenameSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (renamingPlName.trim()) {
      onRenamePlaylist(id, renamingPlName.trim());
      setRenamingPlId(null);
    }
  };

  return (
    <div className="w-60 bg-[#121212]/30 backdrop-blur-3xl p-4 flex flex-col justify-between border-r border-white/5 h-full overflow-hidden select-none">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Header Label */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-purple animate-pulse" />
            <span className="font-display font-black text-xs tracking-[0.15em] text-white/70 uppercase">
              EMOTION CENTER
            </span>
          </div>
          <button className="text-white/40 hover:text-white transition-colors cursor-pointer text-xs">
            <i className="fa-solid fa-sliders" />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="space-y-1 flex-shrink-0">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setActivePlaylistId(null); // Reset playlist filter on main sections
                }}
                className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white/10 text-white font-bold'
                    : 'text-[#8C8C8C] hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="w-4 text-center text-[13px]">
                  <i className={`fa-solid ${item.icon}`} />
                </span>
                {item.label}
              </button>
            );
          })}
          
          <button
            onClick={() => {
              setActiveSection('upload');
              setActivePlaylistId(null);
            }}
            className={`w-full flex items-center gap-4 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeSection === 'upload'
                ? 'bg-brand-purple/20 text-brand-purple font-bold'
                : 'text-[#8C8C8C] hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="w-4 text-center text-[13px] text-brand-purple">
              <i className="fa-solid fa-cloud-arrow-up" />
            </span>
            Upload Files
          </button>
        </nav>

        {/* Custom Playlists List Section (تغيير اسامي البلاي ليست) */}
        <div className="mt-5 flex-shrink-0">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 px-2">
            <span>Playlists ({playlists.length})</span>
            <button
              onClick={() => setShowCreatePl(!showCreatePl)}
              className="p-1 rounded text-white/50 hover:text-white hover:bg-white/5 transition-all text-[11px] cursor-pointer"
              title="Create New Playlist"
            >
              <i className="fa-solid fa-plus" />
            </button>
          </div>

          {showCreatePl && (
            <form onSubmit={handleCreatePlaylistSubmit} className="px-2 mb-2">
              <input
                type="text"
                autoFocus
                placeholder="Playlist name..."
                value={newPlName}
                onChange={e => setNewPlName(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-brand-purple/30 rounded-lg px-2.5 py-1.5 text-[10px] text-white focus:outline-none focus:border-brand-purple"
              />
            </form>
          )}

          <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1">
            <button
              onClick={() => setActivePlaylistId(null)}
              className={`w-full flex items-center justify-between p-1 px-3 rounded-lg text-[10px] uppercase tracking-wider font-semibold transition-all text-left ${
                activePlaylistId === null ? 'bg-brand-purple/10 text-white font-bold' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              All Songs 🎵
            </button>

            {playlists.map((pl) => {
              const isSelected = activePlaylistId === pl.id;
              return (
                <div
                  key={pl.id}
                  onClick={() => {
                    setActivePlaylistId(pl.id);
                    setActiveSection('home'); // Switch to home section to render current tracks
                  }}
                  className={`group/pl-item flex items-center justify-between p-1.5 px-3 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                    isSelected ? 'bg-brand-purple text-white font-bold' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex-1 truncate text-left pr-2">
                    {renamingPlId === pl.id ? (
                      <form
                        onSubmit={(e) => handleRenameSubmit(e, pl.id)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={renamingPlName}
                          onChange={e => setRenamingPlName(e.target.value)}
                          onBlur={(e) => handleRenameSubmit(e, pl.id)}
                          className="w-full bg-black/40 border border-white/20 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none"
                        />
                      </form>
                    ) : (
                      <span>{pl.name}</span>
                    )}
                  </div>
                  
                  {renamingPlId !== pl.id && (
                    <div className="flex items-center gap-1 opacity-0 group-hover/pl-item:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => startRenamePlaylist(pl, e)}
                        className="text-white/50 hover:text-white p-0.5 text-[9px]"
                        title="Rename Playlist"
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this playlist?')) {
                            onDeletePlaylist(pl.id);
                            if (activePlaylistId === pl.id) setActivePlaylistId(null);
                          }
                        }}
                        className="text-white/50 hover:text-red-400 p-0.5 text-[9px]"
                        title="Delete Playlist"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Tracks List Section */}
        <div className="flex-1 mt-4 flex flex-col justify-end overflow-hidden pb-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 px-2 flex justify-between items-center">
            <span>
              <i className="fa-solid fa-list-ul mr-1" />
              {activePlaylistId ? playlists.find(p=>p.id===activePlaylistId)?.name : 'Active List'} ({filteredTracks.length})
            </span>
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[170px] pr-1">
            {filteredTracks.map((track) => {
              const isActive = track.id === currentTrackId;
              return (
                <div
                  key={track.id}
                  className={`group/track flex items-center justify-between p-1.5 rounded-xl transition-all ${
                    isActive ? 'bg-white/10 border-l-2 border-brand-purple' : 'hover:bg-white/5'
                  }`}
                >
                  <div
                    onClick={() => onSelectTrack(track.id)}
                    className="flex items-center gap-2 flex-1 cursor-pointer overflow-hidden"
                  >
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-md object-cover flex-shrink-0"
                    />
                    <div className="overflow-hidden text-left leading-normal">
                      <p className={`text-[11px] font-semibold truncate ${isActive ? 'text-white' : 'text-white/80'}`}>
                        {track.title}
                      </p>
                      <p className="text-[9px] text-white/50 truncate">
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  {/* Context controls for the track: edit, add to play list, and delete */}
                  <div className="flex items-center gap-0.5">
                    {/* Add to Playlist Popup Menu - Click logic */}
                    <div className="relative group/addmenu">
                      <button
                        className="opacity-0 group-hover/track:opacity-100 text-white/40 hover:text-emerald-400 hover:scale-110 transition-all cursor-pointer p-1 text-[10px]"
                        title="Add to custom playlist"
                      >
                        <i className="fa-solid fa-folder-plus" />
                      </button>
                      
                      {/* Hover visible list */}
                      <div className="hidden group-hover/addmenu:block absolute right-0 bottom-5 bg-[#141414] border border-white/10 rounded-xl py-1 w-32 z-50 shadow-2xl text-left">
                        <p className="text-[8px] uppercase tracking-wider text-white/40 px-2 py-0.5 border-b border-white/5">
                          Add track to:
                        </p>
                        {playlists.map(pl => (
                          <button
                            key={pl.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onAddTrackToPlaylist(pl.id, track.id);
                            }}
                            className="w-full text-left px-2.5 py-1 text-[9px] text-white/70 hover:bg-brand-purple hover:text-white transition-all block truncate"
                          >
                            {pl.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Rename Song info button (تغير اسامي الاغاني) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTrack(track);
                      }}
                      className="opacity-0 group-hover/track:opacity-100 text-white/40 hover:text-brand-purple hover:scale-110 transition-all cursor-pointer p-1 text-[10px]"
                      title="Edit song metadata"
                    >
                      <i className="fa-solid fa-pencil" />
                    </button>

                    {onDeleteTrack && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove "${track.title}"?`)) {
                            onDeleteTrack(track.id);
                          }
                        }}
                        className="opacity-0 group-hover/track:opacity-100 text-white/40 hover:text-red-500 hover:scale-110 transition-all cursor-pointer p-1 text-[10px]"
                        title="Delete track"
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            
            {filteredTracks.length === 0 && (
              <div className="text-[10px] text-white/30 text-center py-4 select-none italic font-sans">
                No songs in playlist
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
