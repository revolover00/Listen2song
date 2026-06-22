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
  Pause 
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
  setIsSidebarOpen
}: TopHeaderBarProps) {
  const navItems = [
    { id: 'home', label: 'Home / الرئيسية', IconComponent: Home },
    { id: 'search', label: 'Search / البحث', IconComponent: Search },
    { id: 'songs', label: 'Songs / الأغاني', IconComponent: Music },
    { id: 'albums', label: 'Albums / الألبومات', IconComponent: Disc },
    { id: 'artists', label: 'Artists / الفنانين', IconComponent: User },
    { id: 'mix', label: 'Mix / مكس', IconComponent: Shuffle },
    { id: 'upload', label: 'Upload / رفع ملفات', IconComponent: UploadCloud },
    { id: 'youtube', label: 'YouTube / يوتيوب', IconComponent: Youtube },
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
          title={isSidebarOpen ? "Collapse Sidebar / إغلاق الشريط الجانبي" : "Expand Sidebar / فتح الشريط الجانبي"}
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

      {/* RIGHT: Compact Glassmorphic Audio Player Control Box */}
      <div className="w-full md:w-auto md:max-w-xs xl:max-w-sm flex items-center justify-end select-none shrink-0">
        {currentTrack ? (
          <div className="w-full md:w-[240px] xl:w-[280px] bg-black/45 backdrop-blur-xl p-1.5 px-3 rounded-2xl flex items-center justify-between gap-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/5 hover:border-brand-purple/20 transition-all duration-300 group">
            
            {/* Track metadata */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="relative shrink-0">
                <img
                  src={currentTrack.coverUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className={`w-7.5 h-7.5 rounded-lg object-cover border border-white/10 shadow-sm group-hover:scale-105 transition-transform duration-300 ${
                    isPlaying ? 'animate-spin-slow' : ''
                  }`}
                />
                <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-black ${
                  isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`} />
              </div>
              <div className="overflow-hidden text-left leading-normal">
                <h4 className="text-[11px] font-extrabold text-white leading-tight truncate">
                  {currentTrack.title}
                </h4>
                <p className="text-[9px] text-[#8c8c8c] truncate leading-none mt-0.5">
                  {currentTrack.artist}
                </p>
              </div>
            </div>

            {/* Quick Media controls */}
            <div className="flex items-center gap-1 shrink-0 bg-black/35 rounded-xl p-1 border border-white/5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                className="w-5.5 h-5.5 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer p-0.5"
                title="Prev / السابق"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayPauseToggle();
                }}
                className="w-5.5 h-5.5 rounded-lg flex items-center justify-center bg-brand-purple hover:scale-105 active:scale-95 text-white shadow-md transition-all cursor-pointer p-0.5"
                title={isPlaying ? 'Pause / إيقاف' : 'Play / تشغيل'}
              >
                {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                className="w-5.5 h-5.5 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/5 transition-all cursor-pointer p-0.5"
                title="Next / التالي"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full md:w-[240px] xl:w-[280px] bg-black/25 p-1.5 px-3 rounded-2xl flex items-center justify-center text-[9px] text-[#6c6c6c] uppercase tracking-wider border border-white/5 select-none h-10.5">
            <span className="flex items-center gap-1.5">
              <Disc className="animate-spin text-[10px] text-brand-purple h-3.5 w-3.5" />
              Select Track to listen / اختر أغنية
            </span>
          </div>
        )}
      </div>

    </header>
  );
}
