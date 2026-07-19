export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  audioUrl: string;
  coverUrl: string;
  lyrics: string;
  isExplicit?: boolean;
  isDemo?: boolean;
  source?: 'local' | 'youtube';
  youtubeId?: string;
  isSaved?: boolean;
}

export interface PlayerState {
  currentTrackId: string | null;
  isPlaying: boolean;
  playbackPosition: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeat: 'none' | 'all' | 'one';
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  timestamp: number;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
}

export interface PlayHistoryEntry {
  trackId: string;
  title: string;
  artist: string;
  source: 'local' | 'youtube';
  playedAt: number;
}

