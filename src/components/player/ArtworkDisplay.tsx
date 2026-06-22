import React from 'react';
import { Track } from '../../types';
import { Disc, ChevronRight } from 'lucide-react';

interface ArtworkDisplayProps {
  currentTrack: Track | null;
  upcomingTrack: Track | null;
  onNextTrackClick: () => void;
}

export function ArtworkDisplay({
  currentTrack,
  upcomingTrack,
  onNextTrackClick
}: ArtworkDisplayProps) {
  if (!currentTrack) {
    return (
      <div className="flex-1 h-[350px] md:h-full min-h-[300px] bg-neutral-900 rounded-3xl flex items-center justify-center border border-white/5">
        <div className="text-center text-white/40">
          <Disc className="h-12 w-12 mb-3 animate-spin text-brand-purple mx-auto" />
          <p className="text-base font-semibold">No track selected</p>
          <p className="text-xs">Upload your own music tracks (MP3 or ZIP) to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-[350px] md:h-full min-h-[300px] rounded-3xl relative overflow-hidden group border border-white/5 bg-[#121212]">
      {/* Background Cover Image with subtle transition and smooth animation */}
      <img
        src={currentTrack.coverUrl}
        alt={currentTrack.title}
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover select-none pointer-events-none transition-all duration-700"
      />

      {/* Dim overlay for atmospheric details */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/40" />

      {/* Specific Aesthetic Custom Font Overlays matching the original screenshots! */}
      {currentTrack.id === 'demo-euphoria' && (
        <div className="absolute inset-0 flex flex-col justify-center items-center p-8 select-none pointer-events-none">
          <p className="text-[10px] tracking-[0.2em] font-display font-medium text-[#E0E0E0] mb-2 uppercase text-center">
            ORIGINAL SCORE FROM THE HBO SERIES
          </p>
          <h1 className="text-6xl md:text-7xl font-light tracking-wide text-white font-serif-ital text-center drop-shadow-md">
            euphoria
          </h1>
          <p className="text-[10px] tracking-[0.3em] font-display font-bold text-[#E0E0E0] mt-4 uppercase text-center">
            MUSIC BY <span className="font-extrabold text-white text-xs">LABRINTH</span>
          </p>
        </div>
      )}

      {currentTrack.id === 'demo-humble' && (
        <div className="absolute top-4 left-0 right-0 p-6 flex flex-col items-center select-none pointer-events-none">
          <h1 className="text-8xl md:text-9xl font-extrabold text-[#D2262D] font-cinzel tracking-tight leading-none drop-shadow-lg scale-y-110">
            DAMN.
          </h1>
        </div>
      )}

      {currentTrack.id === 'demo-openarms' && (
        <div className="absolute bottom-6 right-6 p-2 select-none pointer-events-none">
          <span className="text-xs font-display font-extrabold text-white/50 tracking-[0.4em] uppercase">
            PEOPLE
          </span>
        </div>
      )}

      {/* PARENTAL ADVISORY EXPLICIT CONTENT EMBLEM - EXACTLY LIKE SCREENSHOT */}
      {currentTrack.isExplicit && (
        <div className="absolute bottom-6 right-6 select-none bg-black/80 border border-white text-white font-sans text-[7px] font-bold px-1.5 py-0.5 rounded flex flex-col items-center leading-none uppercase tracking-[0.05em]">
          <span>parental</span>
          <span className="text-[10px] font-black -my-0.5">advisory</span>
          <span>explicit content</span>
        </div>
      )}

      {/* Meta Text details for uploaded files */}
      {!currentTrack.id.startsWith('demo-') && (
        <div className="absolute inset-x-0 bottom-6 left-6 p-4 select-none pointer-events-none flex flex-col justify-end items-start text-left">
          <span className="text-[9px] font-bold text-brand-purple tracking-widest uppercase bg-brand-purple/10 px-2.5 py-1 rounded-full border border-brand-purple/20 mb-3">
            Local Session
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white line-clamp-1">
            {currentTrack.title}
          </h2>
          <p className="text-sm text-white/60 line-clamp-1">
            {currentTrack.artist} • {currentTrack.album}
          </p>
        </div>
      )}

      {/* Upper-left title name placeholder for demo content */}
      {currentTrack.id.startsWith('demo-') && (
        <div className="absolute top-6 left-6 select-none">
          <span className="text-[9px] font-bold text-white/40 tracking-widest uppercase">
            PALESTRA EDITION
          </span>
        </div>
      )}

      {/* QUICK 'NEXT >' OVERLAY PILL MATCHING SCREENSHOT */}
      {upcomingTrack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNextTrackClick();
          }}
          className="absolute bottom-6 left-6 mx-0 max-w-[200px] md:max-w-[240px] glass-pill hover:bg-white/15 active:scale-95 text-white p-2.5 rounded-full flex items-center justify-between gap-3 transition-all cursor-pointer select-none group/pill pl-3 pr-4 shadow-lg"
          title={`Play next: ${upcomingTrack.title}`}
        >
          <div className="flex items-center gap-2 overflow-hidden bg-transparent">
            <img
              src={upcomingTrack.coverUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded-full object-cover bg-white/10 group-hover/pill:rotate-45 transition-transform"
            />
            <div className="text-left overflow-hidden bg-transparent">
              <p className="text-[10px] font-bold text-white/95 line-clamp-1 leading-normal">
                {upcomingTrack.title}
              </p>
              <p className="text-[8px] text-white/50 line-clamp-1">
                {upcomingTrack.artist}
              </p>
            </div>
          </div>
          <span className="text-[9px] font-bold uppercase text-brand-purple flex items-center shrink-0 bg-transparent">
            Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </span>
        </button>
      )}
    </div>
  );
}
