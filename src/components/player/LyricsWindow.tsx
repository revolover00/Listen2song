import React, { useEffect, useRef, useMemo } from 'react';
import { Track } from '../../types';
import { useLyrics } from '../../hooks/useLyrics';
import { Copy, Music, Mic } from 'lucide-react';

interface LyricsWindowProps {
  currentTrack: Track | null;
  currentTime: number;
  onToast?: (message: string, type: 'success' | 'info' | 'error') => void;
  onEditCurrentTrack?: () => void;
}

interface ParsedLyric {
  time: number;
  text: string;
}

export function LyricsWindow({ currentTrack, currentTime, onToast, onEditCurrentTrack }: LyricsWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { lyricsData } = useLyrics(currentTrack, onToast);

  // Parse [mm:ss] or [mm:ss.xx] / [mm:ss:xx] and split standard lyric lines
  const parsedLyrics = useMemo<ParsedLyric[]>(() => {
    const rawLyrics = lyricsData?.lyrics || '';
    if (!rawLyrics) return [];

    const lines = rawLyrics.split('\n');
    const result: ParsedLyric[] = [];

    lines.forEach((line) => {
      // Regex parsing timestamps [01:23] or [01:23.45] or [01:23:45]
      const match = line.match(/^\[(\d+):(\d+)(?:[.:](\d+))?\](.*)/);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const ms = match[3] ? parseInt(match[3]) : 0;
        const timeInSeconds = min * 60 + sec + ms / (match[3]?.length === 3 ? 1000 : 100);
        const text = match[4].trim();
        result.push({ time: timeInSeconds, text });
      } else {
        // Fallback for untimed lines
        const cleanText = line.trim();
        if (cleanText) {
          result.push({ time: -1, text: cleanText });
        }
      }
    });

    return result;
  }, [lyricsData]);

  // Is lyrics file synchronized with audio? (Checks if any valid time tags exist)
  const isSynced = useMemo(() => {
    return parsedLyrics.some((l) => l.time !== -1);
  }, [parsedLyrics]);

  // Find currently active timed line index based on current playback audio time
  const activeIndex = useMemo(() => {
    if (!isSynced || parsedLyrics.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [parsedLyrics, currentTime, isSynced]);

  // Center active lyric line using scrollIntoView on change
  useEffect(() => {
    if (isSynced && containerRef.current) {
      const activeElement = containerRef.current.querySelector('.lyric-line-active') as HTMLElement;
      if (activeElement) {
        containerRef.current.scrollTo({
          top: activeElement.offsetTop - containerRef.current.clientHeight / 2 + activeElement.clientHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [activeIndex, isSynced]);

  // Handle clean non-timestamp lyric copying to user clipboard
  const handleCopy = () => {
    if (!lyricsData) return;
    try {
      const cleanText = lyricsData.lyrics
        .split('\n')
        .map((line) => line.replace(/^\[\d+:\d+(?:[.:]\d+)?\]/, '').trim())
        .filter(Boolean)
        .join('\n');
      
      navigator.clipboard.writeText(cleanText);
      onToast?.('Lyrics copied to clipboard! / تم نسخ كلمات الأغنية بنجاح', 'success');
    } catch (e) {
      onToast?.('Failed to copy lyrics / تعذر نسخ أسطر الكلمات', 'error');
    }
  };

  return (
    <div className="glass-panel w-full md:w-[380px] h-[450px] md:h-full min-h-[400px] rounded-3xl p-6 flex flex-col justify-between border border-white/5 relative overflow-hidden transition-all duration-500">
      
      {/* Album cover background styling effect in lyrics panel if available */}
      {lyricsData?.albumArt && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 bg-no-repeat blur-xl select-none pointer-events-none scale-110 duration-1000 transition-all z-0" 
          style={{ backgroundImage: `url(${lyricsData.albumArt})` }}
        />
      )}

      {/* Header Controls area */}
      <div className="flex flex-col gap-3 flex-shrink-0 z-10 select-none pb-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <span className="font-display font-black text-lg tracking-wider text-white flex items-center gap-1.5 uppercase">
            <Music className="w-4 h-4 text-brand-purple" />
            Lyrics
          </span>
          
          <div className="flex items-center gap-2">
            {/* Quick Edit button directly from lyrics display! */}
            {currentTrack && onEditCurrentTrack && (
              <button
                onClick={onEditCurrentTrack}
                className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-brand-purple hover:border-brand-purple text-[10px] sm:text-[11px] font-bold text-white/80 hover:text-white transition-all cursor-pointer"
                title="Edit lyrics and metadata / تعديل الكلمات والبيانات"
              >
                Edit / تعديل
              </button>
            )}

            {/* Copy Lyrics */}
            {lyricsData && lyricsData.lyrics && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all text-white/60 cursor-pointer"
                title="Copy clean lyrics / نسخ الكلمات"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Current Song Thumbnail metadata overlay (only appears if we are playing something) */}
        {currentTrack && (
          <div className="flex items-center gap-3 mt-1.5 bg-white/3 p-2 rounded-xl border border-white/5">
            <img 
              src={lyricsData?.albumArt || currentTrack.coverUrl} 
              alt={currentTrack.title}
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-lg object-cover bg-neutral-950 border border-white/10 flex-shrink-0 shadow-md"
            />
            <div className="overflow-hidden min-w-0 flex-1 text-left">
              <h4 className="text-xs font-bold text-white/95 truncate leading-tight">
                {currentTrack.title}
              </h4>
              <p className="text-[10px] text-white/50 truncate mt-0.5 font-medium">
                {currentTrack.artist}
              </p>
            </div>
            {isSynced && (
              <span className="text-[9px] font-mono text-brand-purple bg-brand-purple/10 border border-brand-purple/20 px-1.5 py-0.5 rounded uppercase shrink-0 tracking-wide font-black animate-pulse">
                Live Sync
              </span>
            )}
          </div>
        )}
      </div>

      {/* Core Lyrics Scrolling box */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 py-6 pr-1 scroll-smooth select-none snap-y snap-proximity text-left relative z-10"
        style={{ scrollbarWidth: 'thin' }}
      >
        {parsedLyrics.length > 0 ? (
          parsedLyrics.map((lyric, idx) => {
            if (!isSynced) {
              // Unsynced lyric rendering
              return (
                <div
                  key={idx}
                  className="py-1 text-white/80 font-medium text-xs md:text-sm hover:text-white transition-all leading-relaxed"
                >
                  {lyric.text}
                </div>
              );
            }

            // Synced lyric rendering
            const isActive = idx === activeIndex;
            const isPassed = activeIndex !== -1 && idx < activeIndex;

            return (
              <div
                key={idx}
                className={`py-1.5 transform transition-all duration-300 origin-left snap-start leading-relaxed ${
                  isActive
                    ? 'lyric-line-active text-brand-purple font-extrabold text-sm md:text-md scale-102 opacity-100 blur-0 shadow-purple'
                    : isPassed
                    ? 'text-white/40 font-medium text-xs md:text-sm opacity-50 blur-[0.5px]'
                    : 'text-white/60 font-medium text-xs md:text-sm opacity-70'
                }`}
              >
                {lyric.text || '• • •'}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center h-full text-white/30 italic pt-10 px-4">
            <Music className="w-8 h-8 opacity-30 mb-2 text-brand-purple" />
            <p className="text-xs">No lyrics loaded for this song / لا توجد كلمات محملة لهذه الأغنية</p>
            {onEditCurrentTrack && (
              <button
                onClick={onEditCurrentTrack}
                className="mt-3 px-3 py-1 bg-brand-purple text-white hover:bg-brand-purple-dark rounded-lg text-[10px] font-bold tracking-tight transition-all cursor-pointer shadow-md"
              >
                Add lyrics / إضافة كلمات الأغنية
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer descriptor status item */}
      <div className="mt-2 text-[9px] text-white/30 text-right uppercase tracking-wider flex-shrink-0 z-10 flex items-center justify-end gap-1 select-none pt-2 border-t border-white/5">
        <Mic className="w-3 h-3 mr-1 text-brand-purple inline" /> 
        {isSynced ? 'Synced Karaoke Mode Active' : 'Static Reading Active'}
      </div>
    </div>
  );
}
