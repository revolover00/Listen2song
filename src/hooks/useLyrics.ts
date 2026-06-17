import { useState, useEffect } from 'react';
import { Track } from '../types';

export interface LyricsData {
  lyrics: string;
  albumArt: string | null;
  artist: string;
  title: string;
}

export function useLyrics(
  currentTrack: Track | null,
  onToast?: (msg: string, type: 'success' | 'info' | 'error') => void
) {
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);

  useEffect(() => {
    if (currentTrack) {
      setLyricsData({
        lyrics: currentTrack.lyrics || '',
        albumArt: currentTrack.coverUrl || null,
        artist: currentTrack.artist,
        title: currentTrack.title
      });
    } else {
      setLyricsData(null);
    }
  }, [currentTrack, currentTrack?.lyrics, currentTrack?.coverUrl, currentTrack?.artist, currentTrack?.title]);

  return {
    lyricsData,
    loading: false,
    error: null,
    searchingBanner: null,
    autoSearchEnabled: false,
    toggleAutoSearch: () => {},
    refetch: () => {}
  };
}
