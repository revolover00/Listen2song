import React from 'react';
import { Track } from '../../types';

interface TopHeaderBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
}

export function TopHeaderBar({
  currentTrack,
  isPlaying,
  onPlayPauseToggle,
  onNext,
  onPrev,
  activeSection,
  setActiveSection
}: TopHeaderBarProps) {
  return (
    <header className="w-full flex-shrink-0 flex items-center justify-between p-3 md:p-4 bg-[#121212]/20 backdrop-blur-xl border-b border-white/5 relative z-30 transition-all duration-300">
      {/* LEFT: Logo / Branding Section */}
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-purple animate-pulse shadow-[0_0_12px_var(--brand-purple)]" />
        <span className="font-display font-black text-xs md:text-sm tracking-[0.2em] text-white/95 uppercase select-none">
          PALESTRA
        </span>
        <span className="hidden sm:inline-block text-[8px] font-mono tracking-widest text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
          EMOTION CORE V2
        </span>
      </div>

      {/* CENTER: High Fidelity Glassmorphic Mini-Player Box (مربع تشغيل الأغاني) */}
      <div className="flex-1 max-w-xs md:max-w-md mx-4">
        {currentTrack ? (
          <div className="w-full glass-pill p-1.5 px-3 rounded-2xl flex items-center justify-between gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.6)] border border-white/5 hover:border-brand-purple/20 transition-all duration-350 select-none group">
            {/* Song Cover & Quick Info */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="relative shrink-0">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className={`w-8 h-8 rounded-lg object-cover border border-white/10 shadow-inner group-hover:scale-105 transition-transform duration-300 ${
                    isPlaying ? 'animate-spin-slow' : ''
                  }`}
                  style={{ boxShadow: '0 0 10px var(--brand-purple-blob)' }}
                />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#030303] ${
                  isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`} />
              </div>
              <div className="overflow-hidden text-left leading-normal">
                <h4 className="text-[11px] font-bold text-white leading-tight truncate">
                  {currentTrack.title}
                </h4>
                <p className="text-[9px] text-white/40 truncate leading-none mt-0.5">
                  {currentTrack.artist}
                </p>
              </div>
            </div>

            {/* Micro Navigation Controls (امكانية التنقل والتحكم من المربع) */}
            <div className="flex items-center gap-1.5 shrink-0 bg-black/35 rounded-xl p-1 border border-white/5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer text-[10px]"
                title="Previous track"
              >
                <i className="fa-solid fa-backward-step" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayPauseToggle();
                }}
                className="w-6 h-6 rounded-lg flex items-center justify-center bg-brand-purple hover:scale-105 active:scale-95 text-white shadow-inner transition-all cursor-pointer text-[10px]"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'}`} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer text-[10px]"
                title="Next track"
              >
                <i className="fa-solid fa-forward-step" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full glass-pill p-1.5 px-3 rounded-2xl flex items-center justify-center text-[10px] text-white/30 font-display uppercase tracking-widest border border-white/5 select-none h-11">
            <span className="animate-pulse flex items-center gap-2">
              <i className="fa-solid fa-compact-disc animate-spin text-[12px] text-brand-purple" />
              Select Track to listen
            </span>
          </div>
        )}
      </div>

      {/* RIGHT: Quick view navigation shortcuts */}
      <div className="flex items-center gap-1.5 md:gap-2">
        <button
          onClick={() => setActiveSection('search')}
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
            activeSection === 'search'
              ? 'bg-brand-purple text-white shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Search Database"
        >
          <i className="fa-solid fa-magnifying-glass" />
        </button>
        <button
          onClick={() => setActiveSection('upload')}
          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
            activeSection === 'upload'
              ? 'bg-brand-purple text-white shadow-md'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
          title="Upload Section"
        >
          <i className="fa-solid fa-cloud-arrow-up" />
        </button>
      </div>
    </header>
  );
}
