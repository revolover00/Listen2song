import { useState, useEffect, useCallback } from 'react';
import { PlayHistoryEntry, Track } from '../types';
import { STORAGE_KEYS } from '../constants';

const MAX_HISTORY = 200;

export function useListeningHistory() {
  const [history, setHistory] = useState<PlayHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAY_HISTORY);
      if (raw) setHistory(JSON.parse(raw));
    } catch (e) {
      console.warn('Failed to load listening history:', e);
    }
  }, []);

  const logPlay = useCallback((track: Track) => {
    setHistory(prev => {
      const entry: PlayHistoryEntry = {
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        source: track.source || 'local',
        playedAt: Date.now(),
      };
      const updated = [entry, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEYS.PLAY_HISTORY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save listening history:', e);
      }
      return updated;
    });
  }, []);

  const getTopArtists = useCallback((limit = 5): string[] => {
    const now = Date.now();
    const scores = new Map<string, number>();

    history.forEach(entry => {
      if (!entry.artist || entry.artist === 'Unknown Artist') return;
      const ageDays = (now - entry.playedAt) / (1000 * 60 * 60 * 24);
      const weight = Math.exp(-ageDays / 14); 
      scores.set(entry.artist, (scores.get(entry.artist) || 0) + weight);
    });

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([artist]) => artist);
  }, [history]);

  const getRecentUniqueTracks = useCallback((limit = 10): PlayHistoryEntry[] => {
    const seen = new Set<string>();
    const result: PlayHistoryEntry[] = [];
    for (const entry of history) {
      if (!seen.has(entry.trackId)) {
        seen.add(entry.trackId);
        result.push(entry);
        if (result.length >= limit) break;
      }
    }
    return result;
  }, [history]);

  return { history, logPlay, getTopArtists, getRecentUniqueTracks };
}
