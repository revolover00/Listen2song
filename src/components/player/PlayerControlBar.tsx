import React from 'react';
import { Track } from '../../types';
import { 
  Shuffle, 
  SkipBack, 
  Pause, 
  Play, 
  SkipForward, 
  Repeat, 
  VolumeX, 
  Volume2, 
  Radio, 
  Youtube, 
  Loader2, 
  Download,
  Minimize2,
  Bookmark
} from 'lucide-react';

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
  onMiniToggle?: () => void;
  onToast?: (message: string, type: 'success' | 'info' | 'error') => void;
  isCurrentTrackSaved?: boolean;
  onToggleSaveCurrent?: () => void;
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
  onRepeatToggle,
  onMiniToggle,
  onToast,
  isCurrentTrackSaved,
  onToggleSaveCurrent
}: PlayerControlBarProps) {

  const [downloadProgress, setDownloadProgress] = React.useState<string | null>(null);

  const downloadSong = async (track: Track) => {
    if (!track) return;
    const vId = track.youtubeId || track.audioUrl;
    if (!vId) return;

    const videoUrl = `https://www.youtube.com/watch?v=${vId}`;
    setDownloadProgress('preparing');
    if (onToast) {
      onToast(`Connecting to downloader...`, 'info');
    }

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoUrl,
          songTitle: track.title
        })
      });

      if (!response.ok) {
        throw new Error('Failed to download');
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        if (json.success && json.redirectUrl) {
          const a = document.createElement('a');
          a.href = json.redirectUrl;
          a.download = `${track.title || 'audio'}.mp3`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (onToast) {
            onToast(`✅ Downloaded "${track.title}" successfully!`, 'success');
          }
          return;
        } else if (json.error) {
          throw new Error(json.error);
        }
      }

      setDownloadProgress('saving');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title || 'audio'}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (onToast) {
        onToast(`✅ Downloaded "${track.title}" successfully!`, 'success');
      }
    } catch (error) {
      console.error(error);
      if (onToast) {
        onToast(`❌ Download failed. Please try again.`, 'error');
      }
    } finally {
      setDownloadProgress(null);
    }
  };

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
            <Shuffle className="h-4 w-4" />
          </button>

          {/* Previous button */}
          <button
            onClick={onPrev}
            className="cursor-pointer text-xs text-white/50 hover:text-white h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/5 transition-all"
            title="Previous"
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </button>

          {/* Main Play/Pause Button */}
          <button
            onClick={onPlayPauseToggle}
            className="cursor-pointer bg-white text-black h-10 w-10 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md shrink-0 p-2.5"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-black fill-current" />
            ) : (
              <Play className="h-4 w-4 text-black fill-current ml-0.5" />
            )}
          </button>

          {/* Next button */}
          <button
            onClick={onNext}
            className="cursor-pointer text-xs text-white/50 hover:text-white h-7 w-7 rounded-full flex items-center justify-center hover:bg-white/5 transition-all"
            title="Next"
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </button>

          {/* Repeat button */}
          <button
            onClick={onRepeatToggle}
            className={`cursor-pointer text-xs h-7 w-7 rounded-lg flex items-center justify-center transition-all relative ${
              isRepeat !== 'none' ? 'text-brand-purple bg-brand-purple/10' : 'text-white/40 hover:text-white'
            }`}
            title={`Repeat: ${isRepeat}`}
          >
            <Repeat className="h-4 w-4" />
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
          className="cursor-pointer text-xs text-white/50 hover:text-white transition-colors flex items-center justify-center animate-hover"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4 text-brand-purple" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={3}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-full max-w-[70px] md:max-w-[80px] h-1 bg-white/10 rounded-lg appearance-none cursor-pointer outline-none accent-brand-purple"
          style={{
            background: volume > 1.0 
              ? `linear-gradient(to right, var(--brand-purple, #7A4AFF) 0%, var(--brand-purple, #7A4AFF) 33.3%, #ff4d4d 33.3%, #ff4d4d ${((isMuted ? 0 : volume) / 3) * 100}%, rgba(255,255,255,0.1) ${((isMuted ? 0 : volume) / 3) * 100}%, rgba(255,255,255,0.1) 100%)`
              : `linear-gradient(to right, var(--brand-purple, #7A4AFF) 0%, var(--brand-purple, #7A4AFF) ${((isMuted ? 0 : volume) / 3) * 100}%, rgba(255,255,255,0.1) ${((isMuted ? 0 : volume) / 3) * 100}%, rgba(255,255,255,0.1) 100%)`
          }}
          title={volume > 1 ? `Volume Boosted: ${Math.round(volume * 100)}%` : `Volume: ${Math.round(volume * 100)}%`}
        />

        <span className={`text-[10px] font-mono min-w-[32px] text-left shrink-0 select-none transition-colors ${volume > 1 ? 'text-red-400 font-bold' : 'text-white/70'}`}>
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>

        <button
          className="cursor-pointer text-xs text-white/50 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-all ml-1 flex items-center justify-center"
          title="AirPlay / Devices"
        >
          <Radio className="h-4 w-4" />
        </button>

        {onMiniToggle && (
          <button
            onClick={onMiniToggle}
            className="cursor-pointer text-xs text-white/50 hover:text-brand-purple hover:bg-brand-purple/10 p-1.5 rounded-lg transition-all ml-1 flex items-center justify-center border border-transparent hover:border-brand-purple/15"
            title="Mini Player Mode"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
        )}

        {currentTrack && (currentTrack.source === 'youtube' || currentTrack.id.startsWith('youtube-')) && (
          <div className="flex items-center gap-1">
            {/* Save to Sidebar bookmark icon */}
            {onToggleSaveCurrent && (
              <button
                onClick={onToggleSaveCurrent}
                className={`cursor-pointer text-xs p-1.5 rounded-lg transition-all flex items-center justify-center ${
                  isCurrentTrackSaved
                    ? 'text-brand-purple bg-brand-purple/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
                title={isCurrentTrackSaved ? 'Remove from sidebar' : 'Save to sidebar'}
              >
                <Bookmark className={`h-4 w-4 ${isCurrentTrackSaved ? 'fill-current' : ''}`} />
              </button>
            )}

            {/* Open on YouTube link */}
            <a
              href={`https://www.youtube.com/watch?v=${currentTrack.youtubeId || currentTrack.audioUrl}`}
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer text-xs text-white/50 hover:text-white hover:bg-white/5 p-1.5 rounded-lg transition-all flex items-center justify-center"
              title="Open on YouTube"
            >
              <Youtube className="h-4 w-4 text-red-500" />
            </a>

            {/* Downloader Button with active spinner feedback */}
            <button
              onClick={() => downloadSong(currentTrack)}
              disabled={downloadProgress !== null}
              className={`cursor-pointer text-xs p-1.5 rounded-lg transition-all flex items-center justify-center ${
                downloadProgress !== null
                  ? 'text-brand-purple bg-brand-purple/10 cursor-not-allowed animate-pulse'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              title={
                downloadProgress === 'preparing'
                  ? 'Preparing download...'
                  : downloadProgress === 'saving'
                  ? 'Saving MP3...'
                  : 'Download song as MP3'
              }
            >
              {downloadProgress === 'preparing' && <Loader2 className="h-4 w-4 animate-spin text-brand-purple" />}
              {downloadProgress === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-brand-purple" />}
              {downloadProgress === null && <Download className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
