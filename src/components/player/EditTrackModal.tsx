import React, { useState, useRef } from 'react';
import { Track } from '../../types';
import { X, Upload, FileText } from 'lucide-react';

interface EditTrackModalProps {
  track: Track;
  onClose: () => void;
  onSave: (trackId: string, title: string, artist: string, album: string, lyrics: string) => void;
}

export function EditTrackModal({ track, onClose, onSave }: EditTrackModalProps) {
  const [title, setTitle] = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum] = useState(track.album);
  const [lyrics, setLyrics] = useState(track.lyrics || '');
  const [lyricsMode, setLyricsMode] = useState<'text' | 'file'>('text');
  const [uploadStatus, setUploadStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setLyrics(text || '');
      setUploadStatus(`Loaded: ${file.name} (${(text || '').split('\n').length} lines)`);
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(track.id, title.trim(), artist.trim() || 'Unknown Artist', album.trim() || 'Single', lyrics.trim());
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
            <X className="h-3.5 w-3.5" />
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
              Song Name
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
              Artist Name
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
              Album Name
            </label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full bg-[#161616]/80 text-white rounded-xl px-3 py-2.5 text-xs font-semibold border border-white/5 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
              placeholder="e.g. Single"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <label className="text-[9px] uppercase tracking-wider text-white/40 font-bold">
                Lyrics
              </label>
              <div className="flex bg-white/5 rounded-lg p-0.5 border border-white/5 gap-0.5 text-[8px] font-bold">
                <button
                  type="button"
                  onClick={() => setLyricsMode('text')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    lyricsMode === 'text' ? 'bg-brand-purple text-white shadow-sm' : 'text-white/40 hover:text-white'
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setLyricsMode('file')}
                  className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                    lyricsMode === 'file' ? 'bg-brand-purple text-white shadow-sm' : 'text-white/40 hover:text-white'
                  }`}
                >
                  File
                </button>
              </div>
            </div>

            {lyricsMode === 'text' ? (
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={3}
                className="w-full bg-[#161616]/80 text-white rounded-xl px-3 py-2 text-xs font-semibold border border-white/5 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all resize-y select-text"
                placeholder="Paste lyrics here [00:15] Lyrics can have timestamps"
              />
            ) : (
              <div className="space-y-2">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border border-dashed border-white/10 hover:border-brand-purple/40 bg-white/[0.02] hover:bg-brand-purple/5 transition-all rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer gap-1"
                >
                  <Upload className="h-4 w-4 text-brand-purple animate-pulse" />
                  <span className="text-[10px] font-bold text-white/60">Choose LRC or TXT File</span>
                  <span className="text-[8px] text-white/30">Click to upload synchronized lyrics file (.lrc)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".lrc,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                {uploadStatus && (
                  <div className="flex items-center gap-1.5 text-[9px] text-brand-purple bg-brand-purple/10 border border-brand-purple/15 px-2.5 py-1 rounded-lg font-semibold animate-fadeIn justify-between">
                    <span className="truncate max-w-[170px]">{uploadStatus}</span>
                    <button 
                      type="button" 
                      onClick={() => { setLyrics(''); setUploadStatus(''); }}
                      className="text-white/40 hover:text-white font-bold cursor-pointer hover:underline text-[8px]"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
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
