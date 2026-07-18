import React from 'react';
import { Track } from '../../types';
import { 
  Home, 
  Search, 
  Music, 
  Disc, 
  User, 
  Shuffle, 
  UploadCloud, 
  Youtube, 
  Menu, 
  SkipBack, 
  SkipForward, 
  Play, 
  Pause,
  Minimize2
} from 'lucide-react';

interface TopHeaderBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPauseToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  activeSection: string;
  setActiveSection: (sec: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  onMiniToggle?: () => void;
}

export function TopHeaderBar({
  currentTrack,
  isPlaying,
  onPlayPauseToggle,
  onNext,
  onPrev,
  activeSection,
  setActiveSection,
  isSidebarOpen,
  setIsSidebarOpen,
  onMiniToggle
}: TopHeaderBarProps) {
  const navItems = [
    { id: 'home', label: 'Home', IconComponent: Home },
    { id: 'search', label: 'Search', IconComponent: Search },
    { id: 'songs', label: 'Songs', IconComponent: Music },
    { id: 'albums', label: 'Albums', IconComponent: Disc },
    { id: 'artists', label: 'Artists', IconComponent: User },
    { id: 'mix', label: 'Mix', IconComponent: Shuffle },
    { id: 'upload', label: 'Upload', IconComponent: UploadCloud },
    { id: 'youtube', label: 'YouTube', IconComponent: Youtube },
  ];

  return (
    <header className="w-full flex-shrink-0 flex flex-col md:flex-row items-center justify-between gap-y-3.5 p-3.5 md:p-4 bg-[#0a0a0af0]/30 backdrop-blur-[28px] backdrop-saturate-150 border-b border-white/10 relative z-30 transition-all duration-300 shadow-[0_8px_32px_0_rgba(0,0,0,0.45)]">
      
      {/* LEFT: Branding / Logo & Sidebar Toggle Button */}
      <div className="flex items-center gap-3 self-start md:self-auto select-none shrink-0">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`cursor-pointer rounded-xl flex items-center justify-center transition-all duration-300 border p-2 ${
            isSidebarOpen 
              ? 'bg-brand-purple border-brand-purple/20 text-white shadow-lg shadow-brand-purple/20 hover:brightness-110' 
              : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
          }`}
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-purple animate-pulse shadow-[0_0_12px_var(--brand-purple)]" />
            <span className="font-display font-black text-xs md:text-sm tracking-[0.25em] text-white/95 uppercase">
              listen2song
            </span>
          </div>
          <span className="text-[7.5px] font-mono tracking-widest text-[#8a8a8a] lowercase italic mt-0.5">
            ultimate sync v2
          </span>
        </div>
      </div>

      {/* CENTER: Capsule Navigation Bar */}
      <div className="flex justify-center items-center select-none w-full md:w-auto shrink-0 animate-fadeIn">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full p-1.5 flex items-center gap-1.5 sm:gap-2 md:gap-2.5 shadow-[0_12px_45px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.05)] transition-all duration-300">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.IconComponent;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                }}
                className={`relative flex items-center justify-center transition-all duration-500 rounded-full cursor-pointer group shrink-0 ${
                  isActive
                    ? 'w-10 h-10 md:w-11 md:h-11 bg-white/10 text-white shadow-[inset_0_1px_2.5px_rgba(255,255,255,0.25),0_6px_16px_rgba(0,0,0,0.4)] scale-[1.04]'
                    : 'w-8.5 h-8.5 md:w-9.5 md:h-9.5 text-white/40 hover:text-white/85 hover:bg-white/5 hover:scale-105'
                }`}
              >
                <span className="p-1">
                  <Icon className="h-4.5 w-4.5 md:h-5 md:w-5" />
                </span>

                {/* Ambient glow around active icon */}
                {isActive && (
                  <span className="absolute inset-0 rounded-full bg-brand-purple/5 blur-[8px] pointer-events-none -z-10" />
                )}

                {/* Elegant floating metadata Tooltip on hover */}
                <span className="absolute top-14 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all duration-200 origin-top bg-neutral-950/95 text-[9px] font-bold uppercase tracking-wider text-white px-2.5 py-1 rounded-md shadow-2xl border border-white/10 pointer-events-none whitespace-nowrap z-50">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Removed as requested */}
      <div className="w-0 md:w-auto select-none shrink-0" />

    </header>
  );
}
