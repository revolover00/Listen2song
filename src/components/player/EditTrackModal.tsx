import React, { useState } from 'react';
import { Track } from '../../types';

interface EditTrackModalProps {
  track: Track;
  onClose: () => void;
  onSave: (trackId: string, title: string, artist: string, album: string) => void;
}

export function EditTrackModal({ track, onClose, onSave }: EditTrackModalProps) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(track.id, title.trim(), artist.trim() || 'Unknown Artist', album.trim() || 'Single');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-fade-in">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-6 border border-white/10 shadow-[0_10px_50px_rgba(0,0,0,0.8)] relative">
        
        {/* Background glow overlay */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-brand-purple/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-brand-purple/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-purple animate-ping" />
            <h3 className="font-display font-black text-[11px] tracking-widest text-[#8A8A8A] uppercase">
              Edit Track Details
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          
          {/* Cover thumbnail preview */}
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
            <img
              src={track.coverUrl}
              alt={track.title}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl object-cover border border-white/10"
            />
            <div className="text-left overflow-hidden">
              <span className="text-[8px] font-mono uppercase tracking-widest text-brand-purple">Currently Editing</span>
              <p className="text-xs font-bold text-white truncate">{track.title}</p>
              <p className="text-[10px] text-white/40 truncate">{track.artist}</p>
            </div>
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-white/40 mb-1.5 font-bold px-1 text-left">
              Song Name (العنوان)
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#161616]/80 text-white rounded-xl px-3 py-2.5 text-xs font-semibold border border-white/5 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
              placeholder="e.g. Leave The Door Open"
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-white/40 mb-1.5 font-bold px-1 text-left">
              Artist Name (الفنان)
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-[#161616]/80 text-white rounded-xl px-3 py-2.5 text-xs font-semibold border border-white/5 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
              placeholder="e.g. Silk Sonic"
            />
          </div>

          <div>
            <label className="block text-[9px] uppercase tracking-wider text-white/40 mb-1.5 font-bold px-1 text-left">
              Album Name (الألبوم)
            </label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full bg-[#161616]/80 text-white rounded-xl px-3 py-2.5 text-xs font-semibold border border-white/5 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
              placeholder="e.g. Single"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple-dark text-white shadow-lg shadow-brand-purple/35 transition-all text-xs font-bold active:scale-95 cursor-pointer"
            >
              Save Changes
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
