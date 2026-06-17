import React from 'react';
import { Track } from '../../types';

interface PlayerControlBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeat: 'none' | 'all' | 'one';
  onPlayPauseToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onMuteToggle: () => void;
  onShuffleToggle: () => void;
  onRepeatToggle: () => void;
}

export function PlayerControlBar({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  isRepeat,
  onPlayPauseToggle,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onShuffleToggle,
  onRepeatToggle
}: PlayerControlBarProps) {

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onSeek(value);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onVolumeChange(value);
  };

  return (
    <div className="bg-[#121212]/30 backdrop-blur-3xl p-4 mx-2 md:mx-6 rounded-3xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] select-none flex flex-col md:flex-row items-center justify-between gap-4">
      
      {/* LEFT: Currently Playing Track Metadata */}
      <div className="flex items-center gap-3 w-full md:w-1/4 min-w-[180px]">
        {currentTrack ? (
          <>
            <img
              src={currentTrack.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className={`w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0 ${
                isPlaying ? 'animate-spin-slow' : ''
              }`}
            />
            <div className="overflow-hidden text-left leading-normal">
              <h4 className="text-xs font-bold text-white line-clamp-1">
                {currentTrack.title}
              </h4>
              <p className="text-[10px] text-white/50 line-clamp-1">
                {currentTrack.artist}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-neutral-800 animate-pulse" />
            <div className="space-y-1">
              <div className="w-20 h-2 bg-neutral-800 rounded animate-pulse" />
              <div className="w-12 h-1.5 bg-neutral-800 rounded animate-pulse" />
            </div>
          </div>
        )}
      </div>

      {/* CENTER: Main Controls and Progress Alignment */}
      <div className="flex-1 flex flex-col items-center gap-1.5 w-full">
        <div className="flex items-center gap-6">
          {/* Shuffle button */}
          <button
            onClick={onShuffleToggle}
            className={`cursor-pointer text-xs h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
              isShuffle ? 'text-brand-purple bg-brand-purple/10' : 'text-white/40 hover:text-white'
            }`}
            title="Shuffle"
          >
            <i className="fa-solid fa-shuffle" />
          </button>

          {/* Previous button */}
          <button
            onClick={onPrev}
            className="cursor-pointer text-xs text-white/50 hover:text-white h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/5 transition-all"
            title="Previous"
          >
            <i className="fa-solid fa-backward-step" />
          </button>

          {/* Main Play/Pause Button */}
          <button
            onClick={onPlayPauseToggle}
            className="cursor-pointer bg-white text-black h-10 w-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            <i className={`fa-solid text-xs ${isPlaying ? 'fa-pause' : 'fa-play ml-0.5'}`} />
          </button>

          {/* Next button */}
          <button
            onClick={onNext}
            className="cursor-pointer text-xs text-white/50 hover:text-white h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/5 transition-all"
            title="Next"
          >
            <i className="fa-solid fa-forward-step" />
          </button>

          {/* Repeat button */}
          <button
            onClick={onRepeatToggle}
            className={`cursor-pointer text-xs h-7 w-7 rounded-lg flex items-center justify-center transition-all relative ${
              isRepeat !== 'none' ? 'text-brand-purple bg-brand-purple/10' : 'text-white/40 hover:text-white'
            }`}
            title={`Repeat: ${isRepeat}`}
          >
            <i className="fa-solid fa-repeat" />
            {isRepeat === 'one' && (
              <span className="absolute bottom-1 right-1 text-[7px] font-black bg-brand-purple text-white rounded-full w-2.5 h-2.5 flex items-center justify-center scale-90">
                1
              </span>
            )}
          </button>
        </div>

        {/* Progress bar line */}
        <div className="w-full max-w-sm flex items-center gap-2">
          <span className="text-[10px] text-white/40 font-mono select-none w-8 text-right shrink-0">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative group flex items-center">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleProgressChange}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer outline-none accent-brand-purple group-hover:bg-white/20 transition-all [&::-webkit-slider-runnable-track]:bg-transparent"
              style={{
                background: `linear-gradient(to right, var(--brand-purple, #7A4AFF) 0%, var(--brand-purple, #7A4AFF) ${currentPercent}%, rgba(255,255,255,0.1) ${currentPercent}%, rgba(255,255,255,0.1) 100%)`
              }}
            />
          </div>
          <span className="text-[10px] text-white/40 font-mono select-none w-8 text-left shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* RIGHT: Volume controller and Extra features */}
      <div className="flex items-center justify-end gap-3 w-full md:w-1/4 shrink-0 pr-1">
        <button
          onClick={onMuteToggle}
          className="cursor-pointer text-xs text-white/50 hover:text-white transition-colors"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <i className={`fa-solid ${isMuted || volume === 0 ? 'fa-volume-xmark text-brand-purple' : 'fa-volume-high'}`} />
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-full max-w-[70px] md:max-w-[80px] h-1 bg-white/10 rounded-lg appearance-none cursor-pointer outline-none accent-brand-purple"
          style={{
            background: `linear-gradient(to right, var(--brand-purple, #7A4AFF) 0%, var(--brand-purple, #7A4AFF) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) 100%)`
          }}
          title={`Volume: ${Math.round(volume * 100)}%`}
        />

        <button
          className="cursor-pointer text-xs text-white/50 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-all ml-1"
          title="AirPlay / Devices"
        >
          <i className="fa-solid fa-circle-nodes" />
        </button>
      </div>

    </div>
  );
}
