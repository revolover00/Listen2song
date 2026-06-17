import { useState, useEffect } from 'react';
import { Track, Playlist } from '../types';
import { DEFAULT_TRACKS, STORAGE_KEYS } from '../constants';
import JSZip from 'jszip';
import { extractID3Cover } from '../utils/id3';
import { getTrackBinary, storeTrackBinary, deleteTrackBinary } from '../utils/db';

export function usePlaylist() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Initialize tracks & playlists from localStorage and rehydrate from IndexedDB
  useEffect(() => {
    const initAndRehydrate = async () => {
      try {
        // 1. Rehydrate tracks
        const stored = localStorage.getItem(STORAGE_KEYS.PLAYLIST);
        let parsed: Track[] = [];
        if (stored) {
          parsed = JSON.parse(stored) as Track[];
        } else {
          parsed = [...DEFAULT_TRACKS];
        }

        // Deduplicate parsed array to prevent duplicate IDs/keys
        const uniqueParsedMap = new Map<string, Track>();
        parsed.forEach(track => {
          if (track && track.id) {
            uniqueParsedMap.set(track.id, track);
          }
        });
        parsed = Array.from(uniqueParsedMap.values());

        // Loop and rehydrate Blob URLs for uploaded tracks stored in IndexedDB
        const rehydratedResults = await Promise.all(
          parsed.map(async (track) => {
            // Self-repair demo track URLs if they are outdated or broken in user's localStorage
            const defaultMatch = DEFAULT_TRACKS.find(dt => dt.id === track.id);
            if (defaultMatch) {
              return {
                ...track,
                audioUrl: defaultMatch.audioUrl, // Sync with newest highly available CORS-open URL
                title: defaultMatch.title,
                artist: defaultMatch.artist,
                album: defaultMatch.album
              };
            }

            if (track.id.startsWith('uploaded-')) {
              try {
                const binary = await getTrackBinary(track.id);
                if (binary) {
                  const audioUrl = URL.createObjectURL(binary.audioBlob);
                  let coverUrl = track.coverUrl;
                  if (binary.coverBlob) {
                    coverUrl = URL.createObjectURL(binary.coverBlob);
                  }
                  return {
                    ...track,
                    audioUrl,
                    coverUrl
                  };
                }
              } catch (e) {
                console.error('Error rehydrating track:', track.id, e);
              }
              return null; // Stale audio track with missing biological file
            }
            return track;
          })
        );

        const rehydrated = rehydratedResults.filter((t): t is Track => t !== null);

        setTracks(rehydrated);

        // 2. Load custom playlists
        const storedPlaylists = localStorage.getItem('palestra_custom_playlists');
        if (storedPlaylists) {
          setPlaylists(JSON.parse(storedPlaylists));
        } else {
          // Setup a default Favorites playlist containing all tracks
          const favoritesPl: Playlist = {
            id: 'playlist-favorites',
            name: 'My Favorites ⭐',
            trackIds: rehydrated.map(t => t.id)
          };
          setPlaylists([favoritesPl]);
          localStorage.setItem('palestra_custom_playlists', JSON.stringify([favoritesPl]));
        }

      } catch (e) {
        console.error('Failed to load playlist / rehydrate:', e);
        setTracks(DEFAULT_TRACKS);
      }
    };

    initAndRehydrate();
  }, []);

  const saveTracks = (newTracks: Track[]) => {
    setTracks(newTracks);
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(newTracks));
    } catch (e) {
      console.error('Failed to save playlist to localStorage:', e);
    }
  };

  const addTrack = (track: Track) => {
    setTracks((prev) => {
      if (prev.some(t => t.id === track.id)) {
        return prev;
      }
      const updated = [...prev, track];
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save playlist to localStorage:', e);
      }
      return updated;
    });
  };

  const addTracks = (newTracksList: Track[]) => {
    setTracks((prev) => {
      const filtered = newTracksList.filter(nt => !prev.some(t => t.id === nt.id));
      if (filtered.length === 0) return prev;
      const updated = [...prev, ...filtered];
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save playlist to localStorage:', e);
      }
      return updated;
    });
  };

  // Delete Track: clean up from list, IndexedDB and custom playlists
  const deleteTrack = (id: string) => {
    setTracks((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(updated));
        deleteTrackBinary(id); // Delete cached binary!
      } catch (e) {
        console.error('Failed to remove track:', e);
      }
      return updated;
    });

    // Remove from playlists too
    setPlaylists((prev) => {
      const updated = prev.map(pl => ({
        ...pl,
        trackIds: pl.trackIds.filter(tid => tid !== id)
      }));
      localStorage.setItem('palestra_custom_playlists', JSON.stringify(updated));
      return updated;
    });
  };

  const clearPlaylist = () => {
    setTracks(DEFAULT_TRACKS);
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(DEFAULT_TRACKS));
    } catch (e) {
      console.error('Failed to clear playlist from localStorage:', e);
    }
  };

  // Edit track metadata (وتغير اسامي الاغاني)
  const updateTrackMetadata = (trackId: string, title: string, artist: string, album: string) => {
    setTracks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === trackId) {
          return {
            ...t,
            title,
            artist,
            album
          };
        }
        return t;
      });
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save updated metadata:', e);
      }
      return updated;
    });
  };

  const updateTrackLyrics = (trackId: string, lyrics: string) => {
    setTracks((prev) => {
      const updated = prev.map((t) => {
        if (t.id === trackId) {
          return {
            ...t,
            lyrics
          };
        }
        return t;
      });
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYLIST, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save updated lyrics:', e);
      }
      return updated;
    });
  };

  // Playlists section (تغيير اسامي البلاي ليست واضافه اغاني لها)
  const createPlaylist = (name: string) => {
    const newPl: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      trackIds: []
    };
    const updated = [...playlists, newPl];
    setPlaylists(updated);
    localStorage.setItem('palestra_custom_playlists', JSON.stringify(updated));
  };

  const renamePlaylist = (id: string, newName: string) => {
    const updated = playlists.map(pl => {
      if (pl.id === id) {
        return { ...pl, name: newName };
      }
      return pl;
    });
    setPlaylists(updated);
    localStorage.setItem('palestra_custom_playlists', JSON.stringify(updated));
  };

  const deletePlaylist = (id: string) => {
    const updated = playlists.filter(pl => pl.id !== id);
    setPlaylists(updated);
    localStorage.setItem('palestra_custom_playlists', JSON.stringify(updated));
  };

  const addTrackToPlaylist = (playlistId: string, trackId: string) => {
    const updated = playlists.map(pl => {
      if (pl.id === playlistId) {
        if (!pl.trackIds.includes(trackId)) {
          return { ...pl, trackIds: [...pl.trackIds, trackId] };
        }
      }
      return pl;
    });
    setPlaylists(updated);
    localStorage.setItem('palestra_custom_playlists', JSON.stringify(updated));
  };

  const removeTrackFromPlaylist = (playlistId: string, trackId: string) => {
    const updated = playlists.map(pl => {
      if (pl.id === playlistId) {
        return { ...pl, trackIds: pl.trackIds.filter(id => id !== trackId) };
      }
      return pl;
    });
    setPlaylists(updated);
    localStorage.setItem('palestra_custom_playlists', JSON.stringify(updated));
  };

  // Helper to parse track details from filename
  const parseFilename = (filename: string): { title: string; artist: string } => {
    const cleanName = filename.replace(/\.[^/.]+$/, ""); // strip extension
    const parts = cleanName.split(/(?:\s*-\s*|\s+-\s+)/);
    if (parts.length > 1) {
      return {
        artist: parts[0].trim(),
        title: parts.slice(1).join(" - ").trim()
      };
    }
    return {
      artist: "Unknown Artist",
      title: cleanName.trim()
    };
  };

  // Process MP3 File with custom IndexedDB local caching
  const handleMp3Upload = async (file: File): Promise<Track> => {
    const { artist, title } = parseFilename(file.name);
    const audioUrl = URL.createObjectURL(file);
    
    let coverUrl = '';
    let coverBlob: Blob | null = null;

    try {
      // Try to parse embedded artwork using our highly robust ID3 scanner
      const arrayBuffer = await file.arrayBuffer();
      const extracted = extractID3Cover(arrayBuffer);
      if (extracted) {
        coverUrl = extracted;
        // Fetch extracted cover blob to store in IndexedDB
        if (extracted.startsWith('blob:')) {
          const res = await fetch(extracted);
          coverBlob = await res.blob();
        }
      }
    } catch (e) {
      console.warn('Could not extract embedded ID3 cover', e);
    }

    if (!coverUrl) {
      // Fallback only if no real embedded artwork is found
      const randomSeed = Math.floor(Math.random() * 1000);
      coverUrl = `https://picsum.photos/seed/${randomSeed}/400/400`;
    }

    const trackId = `uploaded-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newTrack: Track = {
      id: trackId,
      title,
      artist,
      album: 'Local Upload',
      audioUrl,
      coverUrl,
      lyrics: `[00:00] Playing Local Upload: ${title}\n[00:05] Lyrics are not available for imported files.\n[00:10] Enjoy the music on Palestra Player!`,
      isExplicit: false
    };

    // Store binary representation in IndexedDB so it thrives across page refreshes!
    try {
      await storeTrackBinary(trackId, file, coverBlob);
    } catch (e) {
      console.error('Failed to store track in IndexedDB:', e);
    }

    return newTrack;
  };

  // Process ZIP File with custom IndexedDB local caching
  const handleZipUpload = async (file: File): Promise<Track[]> => {
    setLoading(true);
    setProgress(0);
    const newTracksList: Track[] = [];

    try {
      const zip = new JSZip();
      const zipContents = await zip.loadAsync(file);

      // 1. Scan ZIP for loose images to match with the songs
      const zipImages: Record<string, string> = {};
      const zipImageBlobs: Record<string, Blob> = {};
      const imageEntries = Object.keys(zipContents.files).filter(
        name => (name.toLowerCase().endsWith('.jpg') || name.toLowerCase().endsWith('.jpeg') || name.toLowerCase().endsWith('.png') || name.toLowerCase().endsWith('.webp')) && !name.startsWith('__MACOSX')
      );

      let singleFeaturedImage: string | null = null;
      let singleFeaturedBlob: Blob | null = null;
      for (const imgName of imageEntries) {
        try {
          const imgBlob = await zipContents.files[imgName].async('blob');
          const imgUrl = URL.createObjectURL(imgBlob);
          zipImages[imgName.toLowerCase()] = imgUrl;
          zipImageBlobs[imgName.toLowerCase()] = imgBlob;
          singleFeaturedImage = imgUrl; // keeps reference to latest or only cover
          singleFeaturedBlob = imgBlob;
        } catch (err) {
          console.warn('Failed to extract loose image from ZIP:', imgName, err);
        }
      }

      // 1b. Scan ZIP for loose LRC lyrics files
      const zipLyrics: Record<string, string> = {};
      const lrcEntries = Object.keys(zipContents.files).filter(
        name => name.toLowerCase().endsWith('.lrc') && !name.startsWith('__MACOSX')
      );
      for (const lrcName of lrcEntries) {
        try {
          const text = await zipContents.files[lrcName].async('text');
          zipLyrics[lrcName.toLowerCase()] = text;
        } catch (err) {
          console.warn('Failed to extract LRC text from ZIP:', lrcName, err);
        }
      }

      // Helper matching algorithm to find best loose artwork for an MP3 file inside the ZIP
      const getMatchingZipImage = (mp3Path: string): { url: string; blob: Blob | null } | null => {
        const normalizedPath = mp3Path.toLowerCase();
        const pureMp3Name = normalizedPath.split('/').pop() || normalizedPath;
        const mp3BaseName = pureMp3Name.replace(/\.[^/.]+$/, ""); // strip extension
        const mp3Directory = normalizedPath.includes('/') ? normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) : '';

        // Match A: exact filename match with different extension in same subfolder (e.g., song.mp3 -> song.jpg)
        const possibleExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        for (const ext of possibleExtensions) {
          const matchesDirect = mp3Path.replace(/\.[^/.]+$/, ext).toLowerCase();
          if (zipImages[matchesDirect]) {
            return { url: zipImages[matchesDirect], blob: zipImageBlobs[matchesDirect] };
          }
        }

        // Match B: look for direct name match anywhere inside the ZIP (ignores directories)
        for (const ext of possibleExtensions) {
          const keyToLook = mp3BaseName + ext;
          const foundKey = Object.keys(zipImages).find(k => k.endsWith('/' + keyToLook) || k === keyToLook);
          if (foundKey && zipImages[foundKey]) {
            return { url: zipImages[foundKey], blob: zipImageBlobs[foundKey] };
          }
        }

        // Match C: check for folder logo/artwork names (cover.jpg, folder.png, front.jpg, etc.)
        const folderCoverNames = ['cover', 'folder', 'album', 'front', 'poster', 'artwork'];
        for (const coverName of folderCoverNames) {
          for (const ext of possibleExtensions) {
            const keyToLook = (mp3Directory ? mp3Directory + '/' : '') + coverName + ext;
            if (zipImages[keyToLook]) {
              return { url: zipImages[keyToLook], blob: zipImageBlobs[keyToLook] };
            }
          }
        }

        // Match D: find any image file residing in the exact same directory (useful for single-album zips)
        const sameDirImageKey = Object.keys(zipImages).find(k => {
          const imgDir = k.includes('/') ? k.substring(0, k.lastIndexOf('/')) : '';
          return imgDir === mp3Directory;
        });
        if (sameDirImageKey && zipImages[sameDirImageKey]) {
          return { url: zipImages[sameDirImageKey], blob: zipImageBlobs[sameDirImageKey] };
        }

        // Match E: if there is exactly 1 image file in the entire ZIP, apply it to all songs!
        if (imageEntries.length === 1 && singleFeaturedImage) {
          return { url: singleFeaturedImage, blob: singleFeaturedBlob };
        }

        return null;
      };

      // Helper matching algorithm to find best loose LRC file inside the ZIP
      const getMatchingZipLrc = (mp3Path: string): string | null => {
        const normalizedPath = mp3Path.toLowerCase();
        const base = normalizedPath.replace(/\.[^/.]+$/, ""); // strip extension
        const lrcPath = base + '.lrc';
        return zipLyrics[lrcPath] || null;
      };

      // 2. Scan ZIP for MP3 music files
      const fileNames = Object.keys(zipContents.files).filter(
        name => name.toLowerCase().endsWith('.mp3') && !name.startsWith('__MACOSX')
      );

      if (fileNames.length === 0) {
        throw new Error("No MP3 files found in ZIP archive.");
      }

      const totalFiles = fileNames.length;
      for (let i = 0; i < totalFiles; i++) {
        const name = fileNames[i];
        const zipEntry = zipContents.files[name];
        const blob = await zipEntry.async('blob');
        const audioUrl = URL.createObjectURL(blob);
        
        // Extract filename parts
        const pureFilename = name.split('/').pop() || name;
        const { artist, title } = parseFilename(pureFilename);

        // Attempt 1: Match with loose images in the ZIP archive
        const matchResult = getMatchingZipImage(name);
        let coverUrl = matchResult?.url || '';
        let coverBlob = matchResult?.blob || null;

        // Attempt 2: If no zipped loose image is found, extract embedded tag cover from the song bytes
        if (!coverUrl) {
          try {
            const arrayBuffer = await blob.arrayBuffer();
            const extracted = extractID3Cover(arrayBuffer);
            if (extracted) {
              coverUrl = extracted;
              if (extracted.startsWith('blob:')) {
                const res = await fetch(extracted);
                coverBlob = await res.blob();
              }
            }
          } catch (e) {
            console.warn(`Could not read embedded tag cover for zipped song: ${title}`, e);
          }
        }

        // Attempt 3: Final fallback to beautiful random atmospheric seed
        if (!coverUrl) {
          const randomSeed = Math.floor(Math.random() * 1000);
          coverUrl = `https://picsum.photos/seed/${randomSeed+i}/400/400`;
        }

        const trackId = `uploaded-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;
        const zipLrc = getMatchingZipLrc(name);

        newTracksList.push({
          id: trackId,
          title,
          artist,
          album: 'ZIP Archive',
          audioUrl,
          coverUrl,
          lyrics: zipLrc || `No lyrics loaded for ${title}.`,
          isExplicit: false
        });

        // Store each zipped track in IndexedDB so it thrives on reload!
        try {
          await storeTrackBinary(trackId, blob, coverBlob);
        } catch (e) {
          console.error('Failed to store zipped track in IndexedDB:', e);
        }

        setProgress(Math.round(((i + 1) / totalFiles) * 100));
      }
    } catch (e) {
      console.error('Error processing ZIP file:', e);
      throw e;
    } finally {
      setLoading(false);
    }

    return newTracksList;
  };

  return {
    tracks,
    playlists,
    loading,
    progress,
    addTrack,
    addTracks,
    deleteTrack,
    clearPlaylist,
    handleMp3Upload,
    handleZipUpload,
    saveTracks,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    updateTrackMetadata,
    updateTrackLyrics
  };
}
