import { useState, useEffect, useRef } from 'react';
import { Track } from '../types';
import { STORAGE_KEYS } from '../constants';

export function useAudioPlayer(tracks: Track[], onLoadError?: (message: string) => void) {
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState<'none' | 'all' | 'one'>('none');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio instance safely in browser
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
  }

  const currentTrack = tracks.find((t) => t.id === currentTrackId) || null;

  // Sync initial configuration from LocalStorage
  useEffect(() => {
    try {
      const savedTrackId = localStorage.getItem(STORAGE_KEYS.CURRENT_TRACK_ID);
      const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
      const savedRepeat = localStorage.getItem(STORAGE_KEYS.REPEAT_MODE) as 'none' | 'all' | 'one';
      const savedShuffle = localStorage.getItem(STORAGE_KEYS.SHUFFLE_MODE) === 'true';

      if (savedTrackId && tracks.some(t => t.id === savedTrackId)) {
        setCurrentTrackId(savedTrackId);
      } else if (tracks.length > 0) {
        setCurrentTrackId(tracks[0].id);
      }

      if (savedVolume) {
        const parsedVol = parseFloat(savedVolume);
        setVolumeState(parsedVol);
        if (audioRef.current) audioRef.current.volume = parsedVol;
      }

      if (savedRepeat) setIsRepeat(savedRepeat);
      setIsShuffle(savedShuffle);
    } catch (e) {
      console.error('Error fetching player states from localStorage:', e);
    }
  }, [tracks.length]);

  // Handle source changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack && currentTrack.audioUrl) {
      const wasPlaying = isPlaying;
      // Only set and load if the source is different to prevent redundant loads
      if (audio.src !== currentTrack.audioUrl) {
        audio.src = currentTrack.audioUrl;
        audio.load();
      }

      // Reset markers
      setCurrentTime(0);
      setDuration(0);

      if (wasPlaying) {
        audio.play().catch((err) => console.log('Audio autoplay prevented:', err));
      }
    } else {
      audio.removeAttribute('src');
    }
  }, [currentTrackId]);

  // Audio Event Listeners (Time updates, LoadedMetadata, Finished, Errors)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onEnded = () => handleTrackEnded();
    const onError = (e: Event) => {
      console.warn('Audio media error caught and handled gracefully:', e);
      setIsPlaying(false);
      if (onLoadError) {
        onLoadError(`Could not load "${currentTrack?.title || 'the track'}". This song may be unavailable or deleted.`);
      }
      if (tracks.length > 1) {
        setTimeout(() => {
          next();
        }, 2000);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentTrackId, isShuffle, isRepeat, tracks]);

  // Track Ended Router
  const handleTrackEnded = () => {
    if (isRepeat === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.error(e));
      }
    } else {
      next();
    }
  };

  const play = () => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.error('Play failed:', e));
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  const selectTrack = (id: string) => {
    setCurrentTrackId(id);
    localStorage.setItem(STORAGE_KEYS.CURRENT_TRACK_ID, id);
    // Auto play when manually selected
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(e => console.error(e));
      }
    }, 50);
  };

  const next = () => {
    if (tracks.length === 0) return;
    let nextIndex = 0;

    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrackId);
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % tracks.length;
      }
    }
    selectTrack(tracks[nextIndex].id);
  };

  const prev = () => {
    if (tracks.length === 0) return;
    let prevIndex = 0;

    if (isShuffle) {
      prevIndex = Math.floor(Math.random() * tracks.length);
    } else {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrackId);
      if (currentIndex !== -1) {
        prevIndex = currentIndex - 1 < 0 ? tracks.length - 1 : currentIndex - 1;
      }
    }
    selectTrack(tracks[prevIndex].id);
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (v: number) => {
    const vol = Math.max(0, Math.min(1, v));
    setVolumeState(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = vol === 0 ? true : isMuted;
    }
    localStorage.setItem(STORAGE_KEYS.VOLUME, vol.toString());
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (audioRef.current) {
      audioRef.current.muted = newMute;
    }
  };

  const toggleShuffle = () => {
    const fresh = !isShuffle;
    setIsShuffle(fresh);
    localStorage.setItem(STORAGE_KEYS.SHUFFLE_MODE, fresh.toString());
  };

  const toggleRepeat = () => {
    let mode: 'none' | 'all' | 'one' = 'none';
    if (isRepeat === 'none') mode = 'all';
    else if (isRepeat === 'all') mode = 'one';
    setIsRepeat(mode);
    localStorage.setItem(STORAGE_KEYS.REPEAT_MODE, mode);
  };

  // Get next upcoming track preview
  const getNextTrackId = (): string | null => {
    if (tracks.length <= 1) return null;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrackId);
    if (currentIndex === -1) return null;
    const nextIdx = (currentIndex + 1) % tracks.length;
    return tracks[nextIdx].id;
  };

  const upcomingTrack = tracks.find(t => t.id === getNextTrackId()) || null;

  // Synchronize Media Session Metadata & Playback State
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || 'Palestras Emotion',
        artwork: [
          { src: currentTrack.coverUrl, sizes: '96x96' },
          { src: currentTrack.coverUrl, sizes: '128x128' },
          { src: currentTrack.coverUrl, sizes: '192x192' },
          { src: currentTrack.coverUrl, sizes: '256x256' },
          { src: currentTrack.coverUrl, sizes: '384x384' },
          { src: currentTrack.coverUrl, sizes: '512x512' },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {
      console.warn('Failed to set mediaSession metadata:', e);
    }
  }, [currentTrack, isPlaying]);

  // Synchronize Media Session Action Handlers
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prev);
      navigator.mediaSession.setActionHandler('nexttrack', next);
    } catch (error) {
      console.warn('Error registering media session actions:', error);
    }

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          seekTo(details.seekTime);
        }
      });
    } catch (error) {
      console.warn('Error registering media session seekto action:', error);
    }

    return () => {
      if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
        const actionsToClear: MediaSessionAction[] = ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto'];
        for (const action of actionsToClear) {
          try {
            navigator.mediaSession.setActionHandler(action, null);
          } catch (e) {}
        }
      }
    };
  }, [tracks, currentTrackId, isPlaying]);

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffle,
    isRepeat,
    upcomingTrack,
    play,
    pause,
    togglePlay,
    selectTrack,
    next,
    prev,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat
  };
}
