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

export interface YTMusicSong {
  type: 'song';
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  durationSeconds: number;
  thumbnail: string;
  isExplicit: boolean;
}

export interface YTMusicAlbum {
  type: 'album';
  albumId: string;
  title: string;
  artist: string;
  year?: string;
  thumbnail: string;
  trackCount?: number;
}

export interface YTMusicArtist {
  type: 'artist';
  artistId: string;
  name: string;
  thumbnail: string;
  subscriberCount?: string;
}

export interface YTMusicSearchResults {
  topResult?: YTMusicSong | YTMusicAlbum | YTMusicArtist;
  songs: YTMusicSong[];
  albums: YTMusicAlbum[];
  artists: YTMusicArtist[];
  source: 'ytmusic' | 'proxy_fallback' | 'scrape_fallback';
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

