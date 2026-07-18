import React, { useState } from 'react';
import { usePlaylist } from './hooks/usePlaylist';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { useAverageColor } from './hooks/useAverageColor';
import { Sidebar } from './components/player/Sidebar';
import { TopHeaderBar } from './components/player/TopHeaderBar';
import { LyricsWindow } from './components/player/LyricsWindow';
import { ArtworkDisplay } from './components/player/ArtworkDisplay';
import { PlayerControlBar } from './components/player/PlayerControlBar';
import { UploadZone } from './components/player/UploadZone';
import { SearchView } from './components/player/SearchView';
import { YouTubeSearchView } from './components/player/YouTubeSearchView';
import { LibraryView } from './components/player/LibraryView';
import { ToastContainer } from './components/ui/ToastContainer';
import { ToastMessage, Track, Playlist } from './types';
import { EditTrackModal } from './components/player/EditTrackModal';
import { MiniPlayer } from './components/player/MiniPlayer';

export default function App() {
  const [activeSection, setActiveSection] = useState('home');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);

  // Core Hooks State
  const {
    tracks,
    playlists,
    loading: isUploading,
    progress: uploadProgress,
    addTrack,
    addTracks,
    deleteTrack,
    handleMp3Upload,
    handleZipUpload,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    updateTrackMetadata,
    updateTrackLyrics,
    setTrackSaved
  } = usePlaylist();


  // Triggering Toasts
  const addToast = (message: string, type: 'success' | 'info' | 'error') => {
    const newToast: ToastMessage = {
      id: `toast-${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: Date.now()
    };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };


  const player = useAudioPlayer(tracks, (msg) => addToast(msg, 'error'));

  const { accentColor, accentColorLight, accentColorBlob } = useAverageColor(
    player.currentTrack?.coverUrl || null,
    player.currentTrack?.id || null
  );

  // Uploader Actions
  const onMp3Files = async (files: FileList) => {
    const tracksToImport = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const lowerName = file.name.toLowerCase();
      const isAudio = file.type.startsWith('audio/') || 
                      /\.(mp3|wav|m4a|ogg|flac|aac|webm|opus)$/i.test(lowerName);
      if (isAudio) {
        try {
          const track = await handleMp3Upload(file);
          tracksToImport.push(track);
        } catch (e) {
          addToast(`Error adding ${file.name}`, 'error');
        }
      }
    }
    if (tracksToImport.length > 0) {
      addTracks(tracksToImport);
      addToast(`Successfully imported ${tracksToImport.length} audio track(s)!`, 'success');
      setActiveSection('home');
    }
  };

  const onZipFile = async (file: File) => {
    try {
      const extractedTracks = await handleZipUpload(file);
      if (extractedTracks.length > 0) {
        addTracks(extractedTracks);
        addToast(`Extracted ${extractedTracks.length} song(s) from ZIP archive!`, 'success');
        setActiveSection('home');
      } else {
        addToast(`No playable files found.`, 'info');
      }
    } catch (e) {
      addToast(`Could not extract ZIP. Verify structure.`, 'error');
    }
  };

  const onDeleteTrackWithFeedback = (id: string) => {
    const target = tracks.find(t => t.id === id);
    if (target) {
      deleteTrack(id);
      addToast(`Permanently deleted "${target.title}" from library`, 'info');
      if (player.currentTrack?.id === id) {
        player.next();
      }
    }
  };

  return (
    <div 
      className="h-screen w-screen bg-[#030303] text-white flex flex-col p-0 font-sans transition-all duration-[1000ms] selection:bg-brand-purple selection:text-white relative overflow-hidden"
      style={{
        ['--brand-purple' as any]: accentColor,
        ['--brand-purple-dark' as any]: accentColor,
        ['--brand-purple-light' as any]: accentColorLight,
        ['--brand-purple-blob' as any]: accentColorBlob,
      }}
    >
      
      {/* Dynamic Immersive Background Blur with ultra radiant glowing aura */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-[1500ms] ease-in-out">
        {/* Dynamic Glowing Aurora Blobs - Large Pulsating Lights */}
        <div 
          className="absolute -top-[15%] -right-[10%] w-[80vw] h-[80vw] rounded-full blur-[120px] opacity-70 transition-all duration-[1500ms] ease-in-out mix-blend-screen animate-pulse-slow"
          style={{ backgroundColor: accentColorBlob }}
        />
        <div 
          className="absolute -bottom-[15%] -left-[10%] w-[70vw] h-[70vw] rounded-full blur-[120px] opacity-65 transition-all duration-[1500ms] ease-in-out mix-blend-screen animate-pulse-slow"
          style={{ backgroundColor: accentColorBlob }}
        />
        {/* Ambient center radial flare with track accent color light */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85vw] h-[85vh] rounded-full blur-[140px] opacity-65 transition-all duration-[1500ms] ease-in-out mix-blend-screen animate-pulse-slow"
          style={{ background: `radial-gradient(circle, ${accentColor} 0%, rgba(0,0,0,0) 70%)` }}
        />

        {player.currentTrack ? (
          <div 
            className="absolute inset-0 bg-cover bg-center scale-125 blur-[100px] opacity-50 transition-all duration-[1500ms] ease-in-out"
            style={{ backgroundImage: `url(${player.currentTrack.coverUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-radial-gradient from-neutral-950 via-black to-black opacity-80" />
        )}
        {/* High luminosity overlay to let vibrant neon colors bleed through elegantly */}
        <div className="absolute inset-0 bg-black/45 transition-colors duration-1000" />
      </div>

      {/* Container holding the high fidelity music board */}
      {isMiniPlayer ? (
        <div className="w-full h-full text-white flex flex-col items-center justify-center relative z-10 p-6 animate-fadeIn select-none">
          <div className="text-center max-w-sm mt-[-10vh] border border-white/5 bg-black/45 backdrop-blur-3xl px-6 py-4.5 rounded-3xl shadow-2xl">
            <p className="text-sm font-black tracking-[0.2em] text-brand-purple leading-tight uppercase mb-1">
              Ambient Mini Mode
            </p>
            <p className="text-[10px] text-[#8a8a8a] leading-relaxed">
              Draggable mini controller active. Enjoy full synchronized audio with a neat, focused footprint.
            </p>
          </div>
          <MiniPlayer
            currentTrack={player.currentTrack}
            isPlaying={player.isPlaying}
            currentTime={player.currentTime}
            duration={player.duration}
            volume={player.volume}
            isMuted={player.isMuted}
            onPlayPauseToggle={player.togglePlay}
            onNext={player.next}
            onPrev={player.prev}
            onSeek={player.seekTo}
            onVolumeChange={player.setVolume}
            onMuteToggle={player.toggleMute}
            onRestore={() => {
              setIsMiniPlayer(false);
              addToast('Returned to full experience', 'success');
            }}
          />
        </div>
      ) : (
        <div className="w-full h-full text-white flex flex-col md:flex-row overflow-hidden relative z-10 transition-all duration-300">
          
          {/* Left Side: Simplified stacked songs list library, viewable across all sections when active */}
          {isSidebarOpen && (
            <div className="hidden md:flex md:flex-shrink-0 md:h-full animate-fadeIn">
              <Sidebar
                tracks={tracks}
                currentTrackId={player.currentTrack?.id || null}
                onSelectTrack={player.selectTrack}
                onDeleteTrack={onDeleteTrackWithFeedback}
                onEditTrack={(track) => setEditingTrack(track)}
              />
            </div>
          )}


          {/* Right Side: Primary Content Frame with interactive Top Bar */}
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-3 md:p-6 gap-3 md:gap-6">
            
            {/* Top Header Bar containing the integrated Mini Player Box & Sidebar controls */}
            <TopHeaderBar
              currentTrack={player.currentTrack}
              isPlaying={player.isPlaying}
              onPlayPauseToggle={player.togglePlay}
              onNext={player.next}
              onPrev={player.prev}
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              isSidebarOpen={isSidebarOpen}
              setIsSidebarOpen={setIsSidebarOpen}
              onMiniToggle={() => {
                setIsMiniPlayer(true);
                addToast('Switched to Mini Player', 'info');
              }}
            />

            <div className="flex-1 flex flex-col md:flex-row items-center gap-6 overflow-hidden">
              
              {/* View router switcher */}
              {activeSection === 'home' && (
                <>
                  <ArtworkDisplay
                    currentTrack={player.currentTrack}
                    upcomingTrack={player.upcomingTrack}
                    onNextTrackClick={player.next}
                  />
                  <LyricsWindow
                    currentTrack={player.currentTrack}
                    currentTime={player.currentTime}
                    onToast={addToast}
                    onEditCurrentTrack={() => player.currentTrack && setEditingTrack(player.currentTrack)}
                  />
                </>
              )}

              {activeSection === 'upload' && (
                <UploadZone
                  onMp3Upload={onMp3Files}
                  onZipUpload={onZipFile}
                  isProcessing={isUploading}
                  processProgress={uploadProgress}
                />
              )}

              {activeSection === 'search' && (
                <SearchView
                  tracks={tracks}
                  onSelectTrack={player.selectTrack}
                  currentTrackId={player.currentTrack?.id || null}
                  onDeleteTrack={onDeleteTrackWithFeedback}
                />
              )}

              {activeSection === 'youtube' && (
                <YouTubeSearchView
                  onSelectTrack={player.selectTrack}
                  currentTrackId={player.currentTrack?.id || null}
                  addTrack={addTrack}
                  updateTrackLyrics={updateTrackLyrics}
                  addToast={addToast}
                  tracks={tracks}
                  onToggleSave={setTrackSaved}
                />
              )}

              {(activeSection === 'albums' || activeSection === 'artists' || activeSection === 'mix' || activeSection === 'songs') && (
                <LibraryView
                  tracks={tracks}
                  viewType={activeSection as 'albums' | 'artists' | 'mix' | 'songs'}
                  setViewType={(view) => {
                    setActiveSection(view);
                    setActivePlaylistId(null);
                  }}
                  onSelectTrack={player.selectTrack}
                  currentTrackId={player.currentTrack?.id || null}
                  onDeleteTrack={onDeleteTrackWithFeedback}
                  onEditTrack={(track) => setEditingTrack(track)}
                />
              )}

            </div>

            {/* Bottom controls panel component */}
            <div className="flex-shrink-0">
              <PlayerControlBar
                currentTrack={player.currentTrack}
                isPlaying={player.isPlaying}
                currentTime={player.currentTime}
                duration={player.duration}
                volume={player.volume}
                isMuted={player.isMuted}
                isShuffle={player.isShuffle}
                isRepeat={player.isRepeat}
                onPlayPauseToggle={player.togglePlay}
                onNext={player.next}
                onPrev={player.prev}
                onSeek={player.seekTo}
                onVolumeChange={player.setVolume}
                onMuteToggle={player.toggleMute}
                onShuffleToggle={player.toggleShuffle}
                onRepeatToggle={player.toggleRepeat}
                onMiniToggle={() => {
                  setIsMiniPlayer(true);
                  addToast('Switched to Mini Player', 'info');
                }}
                onToast={addToast}
                isCurrentTrackSaved={player.currentTrack ? (tracks.find(t => t.id === player.currentTrack?.id)?.isSaved || false) : false}
                onToggleSaveCurrent={() => {
                  if (player.currentTrack) {
                    const isCurrentlySaved = tracks.find(t => t.id === player.currentTrack?.id)?.isSaved || false;
                    const newSavedState = !isCurrentlySaved;
                    setTrackSaved(player.currentTrack.id, newSavedState);
                    if (newSavedState) {
                      addToast(`Saved "${player.currentTrack.title}" to sidebar list!`, 'success');
                    } else {
                      addToast(`Removed "${player.currentTrack.title}" from sidebar list.`, 'info');
                    }
                  }
                }}
              />
            </div>
          </div>

        </div>
      )}

      {editingTrack && (
        <EditTrackModal
          track={editingTrack}
          onClose={() => setEditingTrack(null)}
          onSave={(trackId, title, artist, album, lyrics) => {
            updateTrackMetadata(trackId, title, artist, album);
            updateTrackLyrics(trackId, lyrics);
            addToast(`Song details and lyrics updated successfully!`, 'success');
          }}
        />
      )}

      {/* Floating high contrast toast overlay */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
