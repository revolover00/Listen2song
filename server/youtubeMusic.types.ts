export interface YTMusicSong {
  type: 'song';
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;      // "3:42"
  durationSeconds: number;
  thumbnail: string;     // مربع، أعلى جودة متاحة
  isExplicit: boolean;
}

export interface YTMusicAlbum {
  type: 'album';
  albumId: string;       // browseId
  title: string;
  artist: string;
  year?: string;
  thumbnail: string;
  trackCount?: number;
}

export interface YTMusicArtist {
  type: 'artist';
  artistId: string;      // browseId (channelId)
  name: string;
  thumbnail: string;
  subscriberCount?: string;
}

export interface YTMusicSearchResults {
  topResult?: YTMusicSong | YTMusicAlbum | YTMusicArtist;
  songs: YTMusicSong[];
  albums: YTMusicAlbum[];
  artists: YTMusicArtist[];
  source: 'ytmusic' | 'proxy_fallback' | 'scrape_fallback'; // مهم للـ debugging والـ UI
}
