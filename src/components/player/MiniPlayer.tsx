import React from 'react';
import { motion } from 'motion/react';
import { Track } from '../../types';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Disc 
} from 'lucide-react';

interface MiniPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onPlayPauseToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onMuteToggle: () => void;
  onRestore: () => void;
}

export function MiniPlayer({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onPlayPauseToggle,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onRestore,
}: MiniPlayerProps) {
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 50 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      drag
      dragMomentum={false}
      dragElastic={0.1}
      className="fixed bottom-8 right-8 z-50 w-72 md:w-80 p-4 rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-3.5 select-none cursor-grab active:cursor-grabbing hover:border-brand-purple/30 transition-colors"
    >
      {/* Upper controls & Restorer */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-purple animate-pulse shadow-[0_0_8px_var(--brand-purple)] animate-pulse-slow" />
          <span className="text-[8px] font-mono tracking-widest text-[#8a8a8a] uppercase bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
            mini player
          </span>
        </div>
        <button
          onClick={onRestore}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-purple/20 text-white/50 hover:text-white transition-all cursor-pointer flex items-center justify-center border border-white/5 active:scale-95"
          title="Restore Full Player"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Track info block with nested radius layout */}
      <div className="flex items-center gap-3">
        {currentTrack ? (
          <>
            <img
              src={currentTrack.coverUrl}
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className={`w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0 shadow-md ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}
            />
            <div className="overflow-hidden text-left leading-tight flex-1">
              <h4 className="text-xs font-black text-white truncate leading-tight tracking-tight">
                {currentTrack.title}
              </h4>
              <p className="text-[9.5px] text-white/50 truncate mt-0.5 font-medium">
                {currentTrack.artist}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/20 shrink-0">
              <Disc className="h-6 w-6 animate-spin-slow text-brand-purple" />
            </div>
            <div className="overflow-hidden text-left leading-normal flex-1">
              <div className="w-24 h-2 rounded bg-white/10 animate-pulse" />
              <div className="w-16 h-1.5 rounded bg-white/5 animate-pulse mt-2" />
            </div>
          </>
        )}
      </div>

      {/* Progress slider */}
      <div className="space-y-1">
        <div className="flex items-center group relative">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer outline-none accent-brand-purple group-hover:bg-white/20 transition-all [&::-webkit-slider-runnable-track]:bg-transparent"
            style={{
              background: `linear-gradient(to right, var(--brand-purple, #7A4AFF) 0%, var(--brand-purple, #7A4AFF) ${currentPercent}%, rgba(255,255,255,0.1) ${currentPercent}%, rgba(255,255,255,0.1) 100%)`
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[8px] text-white/40 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback action controls bar */}
      <div className="flex items-center justify-between px-1">
        {/* Mute and volume slider in micro-pill layout */}
        <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-2 py-1 border border-white/5 shrink-0 max-w-[95px] overflow-hidden">
          <button
            onClick={onMuteToggle}
            className="text-white/40 hover:text-white transition-colors cursor-pointer flex items-center justify-center p-0.5 shrink-0"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-3 w-3 text-brand-purple" />
            ) : (
              <Volume2 className="h-3 w-3" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-10 h-1 bg-white/15 rounded-lg appearance-none cursor-pointer outline-none accent-white/80"
          />
        </div>

        {/* Media action controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            className="text-white/50 hover:text-white h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/5 transition-all cursor-pointer"
            title="Previous"
          >
            <SkipBack className="h-3.5 w-3.5 fill-current" />
          </button>
          <button
            onClick={onPlayPauseToggle}
            className="bg-white hover:bg-neutral-100 text-black h-8 w-8 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all p-2 select-none cursor-pointer shadow-md"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5 fill-current text-black" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current text-black ml-0.5" />
            )}
          </button>
          <button
            onClick={onNext}
            className="text-white/50 hover:text-white h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/5 transition-all cursor-pointer"
            title="Next"
          >
            <SkipForward className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
