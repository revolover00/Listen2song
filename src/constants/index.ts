import { Track } from '../types';

export const DEFAULT_TRACKS: Track[] = [
  {
    id: 'demo-euphoria',
    title: 'Formula (Synth Test)',
    artist: 'Labrinth',
    album: 'Original Score From The HBO Series Euphoria',
    audioUrl: 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/ambient-loop.mp3',
    coverUrl: '/src/assets/images/euphoria_soundtrack_1781607257737.jpg',
    isExplicit: true,
    isDemo: true,
    lyrics: `I lost my mind in a flash of ultraviolet light
Running from the truth that I hold in inside

The lights are on but there's no one here
Puffing with the dragons
I'm livin' for the thrill, formula

I can't feel my face but I know I'm awake
In a beautiful haze that we both tried to make

The lights are on but there's no one here
Puffing with the dragons
I'm livin' for the thrill, formula`
  },
  {
    id: 'demo-humble',
    title: 'HUMBLE. (Acoustic Ambient)',
    artist: 'Kendrick Lamar',
    album: 'DAMN.',
    audioUrl: 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/rain.mp3',
    coverUrl: '/src/assets/images/damn_album_cover_1781607271376.jpg',
    isExplicit: true,
    isDemo: true,
    lyrics: `Nobody pray for me
Even if you're not in agreement

Show me somethin' natural like afro on Richard Pryor
Show me somethin' natural, I wanna feel some stretch marks

Be humble
Sit down
Be humble
Sit down
Lil' b*tch, sit down
Be humble`
  },
  {
    id: 'demo-openarms',
    title: 'Chopin - Nocturne Op. 9 No. 2',
    artist: 'SZA feat. Travis Scott',
    album: 'SOS',
    audioUrl: 'https://raw.githubusercontent.com/scottschiller/SoundManager2/master/demo/_mp3/sine-1min.mp3',
    coverUrl: '/src/assets/images/sza_ctrl_cover_1781607287766.jpg',
    isExplicit: false,
    isDemo: true,
    lyrics: `I've been drinking more alcohol for the past five days
Did you check on me? Now, did you look for me?

I run to you with open arms
No matter how much you break me apart

Did you check on me? Now, did you look for me?
You know I need you, I need your warmth

I run to you with open arms
No matter how much you break me`
  }
];

export const STORAGE_KEYS = {
  PLAYLIST: 'palestra_playlist',
  CURRENT_TRACK_ID: 'palestra_current_track_id',
  VOLUME: 'palestra_volume',
  PLAYBACK_POSITION: 'palestra_playback_position',
  REPEAT_MODE: 'palestra_repeat_mode',
  SHUFFLE_MODE: 'palestra_shuffle_mode'
};
