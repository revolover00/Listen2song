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
  const ytPlayerRef = useRef<any>(null);
  const loadedYtVideoIdRef = useRef<string | null>(null);
  const volumeRef = useRef<number>(0.8);
  const [isYtReady, setIsYtReady] = useState(false);
  const onEndedRef = useRef<() => void>(() => {});
  const nextRef = useRef<() => void>(() => {});

  // Initialize Audio instance safely in browser
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
  }

  const currentTrack = tracks.find((t) => t.id === currentTrackId) || null;

  // Initialize YouTube player container and loader
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let container = document.getElementById('youtube-player-element');
    if (!container) {
      const wrapper = document.createElement('div');
      wrapper.id = 'youtube-player-wrapper';
      wrapper.style.position = 'fixed';
      wrapper.style.bottom = '0';
      wrapper.style.right = '0';
      wrapper.style.width = '200px';
      wrapper.style.height = '200px';
      wrapper.style.overflow = 'hidden';
      wrapper.style.opacity = '0.001';
      wrapper.style.pointerEvents = 'none';
      wrapper.style.zIndex = '-9999';

      container = document.createElement('div');
      container.id = 'youtube-player-element';

      wrapper.appendChild(container);
      document.body.appendChild(wrapper);
    }

    const initYTPlayer = () => {
      const YT = (window as any).YT;
      if (!YT?.Player) return;
      // Prevent double-init (React Strict Mode runs effects twice in dev)
      if (ytPlayerRef.current) return;
      try {
        ytPlayerRef.current = new YT.Player('youtube-player-element', {
          height: '200',
          width: '200',
          videoId: '',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              setIsYtReady(true);
              // Use volumeRef to get the CURRENT volume, not the stale closure value
              try {
                ytPlayerRef.current.setVolume(volumeRef.current * 100);
              } catch (e) {}
            },
            onStateChange: (event: any) => {
              if (event.data === 0) {
                onEndedRef.current();
              } else if (event.data === 1) {
                setIsPlaying(true);
              } else if (event.data === 2) {
                setIsPlaying(false);
              }
            },
            onError: (e: any) => {
              console.warn('YouTube Player error:', e);
              setIsPlaying(false);
              if (onLoadError) {
                onLoadError('Failed to play this YouTube video. Moving to next track.');
              }
              setTimeout(() => { nextRef.current(); }, 2000);
            }
          }
        });
      } catch (err) {
        console.error('Error creating YT.Player:', err);
      }
    };

    // Set the global callback YouTube API expects
    (window as any).onYouTubeIframeAPIReady = initYTPlayer;

    // Also try immediately in case the API already loaded
    if ((window as any).YT?.Player) {
      initYTPlayer();
    }
  }, []);

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
        if (audioRef.current) audioRef.current.volume = parsedVol;
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

    if (isCurrentYt) {
      // Pause and release local audio tag
      audio.pause();
      audio.removeAttribute('src');

      const vId = currentTrack?.youtubeId || currentTrack?.audioUrl || '';
      
      setCurrentTime(0);
      setDuration(0);

      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function' && vId) {
        try {
          if (loadedYtVideoIdRef.current !== vId) {
            loadedYtVideoIdRef.current = vId;
            if (isPlaying) {
              ytPlayerRef.current.loadVideoById({ videoId: vId });
              ytPlayerRef.current.playVideo();
            } else {
              ytPlayerRef.current.cueVideoById({ videoId: vId });
            }
          }
        } catch (e) {
          console.error("Failed to load video:", e);
        }
      }
    } else {
      // Reset loaded YT video
      loadedYtVideoIdRef.current = null;

      // Pause YouTube player if active
      if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      }

      if (currentTrack && currentTrack.audioUrl) {
        // Only set and load if the source is different to prevent redundant loads
        if (audio.src !== currentTrack.audioUrl) {
          audio.src = currentTrack.audioUrl;
          audio.load();
        }

        // Reset markers
        setCurrentTime(0);
        setDuration(0);

        if (isPlaying) {
          audio.play().catch((err) => console.log('Audio autoplay prevented:', err));
        }
      } else {
        audio.removeAttribute('src');
      }
    }
  }, [currentTrackId, isYtReady, isPlaying]);

  // Synchronize playing state with player engines
  useEffect(() => {
    const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
    if (isCurrentYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function' && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try {
          if (isPlaying) {
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.pauseVideo();
          }
        } catch (e) {
          console.error('[isPlaying hook sync] error:', e);
        }
      }
    } else {
      if (audioRef.current) {
        if (isPlaying) {
          audioRef.current.play().catch(e => console.log('Audio play prevented:', e));
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [isPlaying, currentTrackId]);

  // Poll YouTube playing states
  useEffect(() => {
    const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
    if (!isCurrentYt || !isPlaying) return;

    const interval = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const t = ytPlayerRef.current.getCurrentTime() || 0;
          const d = ytPlayerRef.current.getDuration() || 0;
          setCurrentTime(t);
          setDuration(d);
        } catch (e) {
          console.warn("Error polling YouTube timing:", e);
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [currentTrackId, isPlaying]);

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

  // Track Ended Router
  const handleTrackEnded = () => {
    if (isRepeat === 'one') {
      const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
      if (isCurrentYt) {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
          try {
            ytPlayerRef.current.seekTo(0, true);
            ytPlayerRef.current.playVideo();
          } catch(e){}
        }
      } else if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => console.error(e));
      }
    } else {
      next();
    }
  };

  const play = () => {
    const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
    if (isCurrentYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
        try {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        } catch (e) {}
      }
    } else {
      if (audioRef.current && currentTrack) {
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch((e) => console.error('Play failed:', e));
      }
    }
  };

  const pause = () => {
    const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
    if (isCurrentYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        try {
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
        } catch (e) {}
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
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

    // For YouTube tracks, only set isPlaying after YT player confirms ready
    if (isYt && !isYtReady) {
      // The [currentTrackId, isYtReady, isPlaying] effect will auto-play once ready
      setIsPlaying(true);
    } else {
      setIsPlaying(true);
    }
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
    const isCurrentYt = currentTrack?.source === 'youtube' || currentTrack?.id?.startsWith('youtube-');
    if (isCurrentYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          ytPlayerRef.current.seekTo(time, true);
          setCurrentTime(time);
        } catch (e) {}
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
      }
    }
  };

  const setVolume = (v: number) => {
    const vol = Math.max(0, Math.min(1, v));
    volumeRef.current = vol;
    setVolumeState(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = vol === 0 ? true : isMuted;
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(vol * 100);
      } catch (e) {}
    }
    localStorage.setItem(STORAGE_KEYS.VOLUME, vol.toString());
  };

  const toggleMute = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (audioRef.current) {
      audioRef.current.muted = newMute;
    }
    // Also mute/unmute YouTube player
    if (ytPlayerRef.current) {
      try {
        if (newMute) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
        }
      } catch (e) {}
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
