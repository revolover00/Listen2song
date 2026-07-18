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
  const [unplayedShuffleIds, setUnplayedShuffleIds] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef<number>(0.8);
  const onEndedRef = useRef<() => void>(() => {});
  const nextRef = useRef<() => void>(() => {});
  const isInternalLoadingRef = useRef<boolean>(false);

  // Web Audio API refs for volume boost up to 300%
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const limiterNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const initWebAudio = () => {
    if (!audioRef.current || typeof window === 'undefined') return;
    if (audioCtxRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      /** 
       * Senior Audio Engineering Pipeline:
       * 1. Source (HTML5 Audio)
       * 2. High-Pass Filter (Remove DC offset and sub-harmonics below 20Hz to preserve headroom)
       * 3. Pre-amp Gain (The 300% boost stage)
       * 4. Dynamics Compressor (Acting as a Brickwall Limiter to prevent 0dBFS clipping)
       * 5. Destination (Hardware Output)
       */
      const source = ctx.createMediaElementSource(audioRef.current);
      
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.setValueAtTime(20, ctx.currentTime);
      
      const gainNode = ctx.createGain();
      
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-0.5, ctx.currentTime); 
      limiter.knee.setValueAtTime(0, ctx.currentTime);
      limiter.ratio.setValueAtTime(20, ctx.currentTime);
      limiter.attack.setValueAtTime(0.001, ctx.currentTime);
      limiter.release.setValueAtTime(0.1, ctx.currentTime);

      source.connect(hpf);
      hpf.connect(gainNode);
      gainNode.connect(limiter);
      limiter.connect(ctx.destination);
      
      audioCtxRef.current = ctx;
      gainNodeRef.current = gainNode;
      limiterNodeRef.current = limiter;
      sourceNodeRef.current = source;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (err) {
      console.warn("Professional Audio Engine initialization failed:", err);
    }
  };

  // Initialize Audio instance safely in browser
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
  }

  const currentTrack = tracks.find((t) => t.id === currentTrackId) || null;

  // Initialize YouTube player container and loader - REMOVED (Now using standard audio streaming)
  /*
  useEffect(() => {
    ...
  }, []);
  */

  // Sync latest handleTrackEnded & next functions
  useEffect(() => {
    onEndedRef.current = handleTrackEnded;
    nextRef.current = next;
  });

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
        volumeRef.current = parsedVol;
        setVolumeState(parsedVol);
        if (audioRef.current) {
          audioRef.current.volume = Math.min(1, parsedVol);
        }
      }

      if (savedRepeat) setIsRepeat(savedRepeat);
      setIsShuffle(savedShuffle);
    } catch (e) {
      console.error('Error fetching player states from localStorage:', e);
    }
  }, [tracks.length]);

  // Initialize/sync shuffle queue when shuffle is enabled or track count changes
  useEffect(() => {
    if (isShuffle) {
      const allIds = tracks.map(t => t.id);
      const remaining = allIds.filter(id => id !== currentTrackId);
      setUnplayedShuffleIds(remaining.length > 0 ? remaining : allIds);
    } else {
      setUnplayedShuffleIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShuffle, tracks.length]);

  // Handle source and track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
    let targetSrc = '';

    if (isCurrentYt) {
      const vId = currentTrack?.youtubeId || currentTrack?.audioUrl || '';
      targetSrc = vId ? `/api/audio-stream/${vId}` : '';
    } else {
      targetSrc = currentTrack?.audioUrl || '';
    }

    if (targetSrc && audio.src !== (targetSrc.startsWith('/') ? window.location.origin + targetSrc : targetSrc)) {
      isInternalLoadingRef.current = true;
      audio.pause();
      audio.src = targetSrc;
      
      // Reset markers
      setCurrentTime(0);
      setDuration(0);

      const playAudio = () => {
        if (isPlaying) {
          audio.play().catch(err => {
            if (err.name !== 'AbortError') {
              console.warn('Playback error:', err);
            }
          });
        }
        isInternalLoadingRef.current = false;
      };

      // Use a larger delay to ensure the browser has finished the previous request interruption
      // and prevent "interrupted by a new load request" errors (standard professional practice)
      const timer = setTimeout(() => {
        try {
          audio.load();
          playAudio();
        } catch (loadErr) {
          console.warn('Audio load error:', loadErr);
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [currentTrackId, tracks, isPlaying]);

  // Synchronize playing state with player engines
  useEffect(() => {
    if (audioRef.current && !isInternalLoadingRef.current) {
      if (isPlaying) {
        if (audioRef.current.paused) {
          audioRef.current.play().catch(e => {
            if (e.name !== 'AbortError') console.log('Audio play prevented:', e);
          });
        }
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Poll YouTube playing states - DISABLED (Now using standard audio streaming)
  /*
  useEffect(() => {
    ...
  }, [currentTrackId, isPlaying, tracks]);
  */

  // Sync volume state to audio element and Web Audio nodes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const targetGain = isMuted ? 0 : volume;
    
    if (gainNodeRef.current && audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      audio.volume = 1.0; // Audio element stays at 100%, Web Audio gain node handles the actual volume including boost
      gainNodeRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.02);
    } else {
      audio.volume = Math.min(1, targetGain);
    }
    audio.muted = isMuted;
  }, [volume, isMuted]);

  // Audio Event Listeners (Time updates, LoadedMetadata, Finished, Errors)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
      if (!isCurrentYt) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const onLoadedMetadata = () => {
      const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
      if (!isCurrentYt) {
        setDuration(audio.duration || 0);
      }
    };

    const onEnded = () => {
      const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
      if (!isCurrentYt) {
        handleTrackEnded();
      }
    };

    const onError = (e: Event) => {
      const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
      if (isCurrentYt) return; // YouTube handles its own errors
      
      // Ignore if there is no genuine source set or if the source is cleared
      if (!audio.src || audio.src === window.location.href || audio.src === '') {
        return;
      }
      
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

  // Senior Engineering: Silent Audio Heartbeat logic
  // This keeps the browser's audio pipeline active even when the tab is backgrounded
  const heartbeatAudioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Create a 1-second silent MP3 base64 to keep the audio pipeline alive
    const silentBlob = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    const audio = new Audio(silentBlob);
    audio.loop = true;
    heartbeatAudioRef.current = audio;
  }, []);

  const startHeartbeat = () => {
    if (heartbeatAudioRef.current) {
      heartbeatAudioRef.current.play().catch(() => {
        // Fallback: browser might block until user interaction
      });
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatAudioRef.current) {
      heartbeatAudioRef.current.pause();
    }
  };

  // Senior Strategy: Prevent Browser Throttling & Visibility Pauses
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        // When coming back, we can stop the heartbeat to save battery if we want
        // stopHeartbeat(); 
      } else {
        // Tab is hidden - activate heartbeat and ensure MediaSession is active
        if (isPlaying) {
          startHeartbeat();
          if (navigator.mediaSession) {
            navigator.mediaSession.playbackState = 'playing';
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopHeartbeat();
    };
  }, [isPlaying]);

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
    if (tracks.length > 0) {
      if (!gainNodeRef.current && typeof window !== 'undefined') {
        initWebAudio();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      setIsPlaying(true);
    }
  };

  const pause = () => {
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  const selectTrack = (id: string) => {
    const track = tracks.find(t => t.id === id);
    const isYt = track?.source === 'youtube' || id.startsWith('youtube-');
    setCurrentTrackId(id);
    localStorage.setItem(STORAGE_KEYS.CURRENT_TRACK_ID, id);
    
    // Remove from unplayed shuffle list when played
    setUnplayedShuffleIds(prevUnplayed => {
      const updated = prevUnplayed.filter(item => item !== id);
      return updated;
    });

    setIsPlaying(true);
  };

  const next = () => {
    if (tracks.length === 0) return;

    if (isShuffle) {
      const allIds = tracks.map(t => t.id);
      let availableUnplayed = unplayedShuffleIds.filter(id => allIds.includes(id));
      
      // If we don't have any unplayed tracks left, replenish it!
      if (availableUnplayed.length === 0) {
        // Replenish with all tracks except the current playing one (to avoid consecutive plays)
        availableUnplayed = allIds.filter(id => id !== currentTrackId);
        if (availableUnplayed.length === 0) {
          availableUnplayed = allIds;
        }
      }
      
      // Pick a random track from the remaining unplayed queue
      const randomIndex = Math.floor(Math.random() * availableUnplayed.length);
      const chosenId = availableUnplayed[randomIndex];
      
      // Remove the chosen track from the unplayed queue
      const nextUnplayed = availableUnplayed.filter(id => id !== chosenId);
      setUnplayedShuffleIds(nextUnplayed);
      
      selectTrack(chosenId);
    } else {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrackId);
      let nextIndex = 0;
      if (currentIndex !== -1) {
        nextIndex = (currentIndex + 1) % tracks.length;
      }
      selectTrack(tracks[nextIndex].id);
    }
  };

  const prev = () => {
    if (tracks.length === 0) return;

    if (isShuffle) {
      const allIds = tracks.map(t => t.id);
      let availableUnplayed = unplayedShuffleIds.filter(id => allIds.includes(id));
      
      if (availableUnplayed.length === 0) {
        availableUnplayed = allIds.filter(id => id !== currentTrackId);
        if (availableUnplayed.length === 0) {
          availableUnplayed = allIds;
        }
      }

      const randomIndex = Math.floor(Math.random() * availableUnplayed.length);
      const chosenId = availableUnplayed[randomIndex];
      
      const nextUnplayed = availableUnplayed.filter(id => id !== chosenId);
      setUnplayedShuffleIds(nextUnplayed);
      
      selectTrack(chosenId);
    } else {
      const currentIndex = tracks.findIndex((t) => t.id === currentTrackId);
      let prevIndex = 0;
      if (currentIndex !== -1) {
        prevIndex = currentIndex - 1 < 0 ? tracks.length - 1 : currentIndex - 1;
      }
      selectTrack(tracks[prevIndex].id);
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolume = (v: number) => {
    const vol = Math.max(0, Math.min(3, v));
    volumeRef.current = vol;
    setVolumeState(vol);
    if (audioRef.current) {
      if (!gainNodeRef.current && typeof window !== 'undefined') {
        initWebAudio();
      }
      
      if (gainNodeRef.current && audioCtxRef.current) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        audioRef.current.volume = 1.0;
        const targetGain = isMuted ? 0 : vol;
        gainNodeRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.02);
      } else {
        audioRef.current.volume = Math.min(1, vol);
      }
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
    if (isShuffle) {
      const allIds = tracks.map(t => t.id);
      const availableUnplayed = unplayedShuffleIds.filter(id => allIds.includes(id));
      if (availableUnplayed.length > 0) {
        return availableUnplayed[0];
      }
      const potential = allIds.filter(id => id !== currentTrackId);
      return potential.length > 0 ? potential[0] : allIds[0];
    }
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
          { src: currentTrack.coverUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      // Crucial: Update playback state and position for background sync
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      
      if ('setPositionState' in navigator.mediaSession && duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: currentTime,
        });
      }
    } catch (e) {
      console.warn('Failed to set mediaSession metadata:', e);
    }
  }, [currentTrack, isPlaying, currentTime, duration]);

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
