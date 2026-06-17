import React, { useEffect, useRef, useMemo } from 'react';

interface LyricsWindowProps {
  lyrics: string;
  currentTime: number;
}

interface ParsedLyric {
  time: number;
  text: string;
}

export function LyricsWindow({ lyrics, currentTime }: LyricsWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse [mm:ss] format or just split standard lines
  const parsedLyrics = useMemo<ParsedLyric[]>(() => {
    if (!lyrics) return [];
    
    const lines = lyrics.split('\n');
    const result: ParsedLyric[] = [];

    lines.forEach((line) => {
      const match = line.match(/^\[(\d+):(\d+)\](.*)/);
      if (match) {
        const min = parseInt(match[1]);
        const sec = parseInt(match[2]);
        const timeInSeconds = min * 60 + sec;
        const text = match[3].trim();
        result.push({ time: timeInSeconds, text });
      } else {
        // Fallback for untimed lyrics: space lines out roughly (e.g., every 8 seconds)
        // or just store as time = -1
        result.push({ time: -1, text: line.trim() });
      }
    });

    // If all are untimed, offset them spaced out
    const untimed = result.every((r) => r.time === -1);
    if (untimed && result.length > 0) {
      return result.map((item, idx) => ({
        time: idx * 6, // Estimate 6 seconds per line for demonstration
        text: item.text,
      }));
    }

    return result.sort((a, b) => a.time - b.time);
  }, [lyrics]);

  // Find active line index based on current playback position
  const activeIndex = useMemo(() => {
    if (parsedLyrics.length === 0) return -1;
    let activeIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  }, [parsedLyrics, currentTime]);

  // Auto-scroll logic to center the active line
  useEffect(() => {
    if (activeIndex !== -1 && containerRef.current) {
      const activeElement = containerRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        containerRef.current.scrollTo({
          top: activeElement.offsetTop - containerRef.current.clientHeight / 2 + activeElement.clientHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [activeIndex]);

  return (
    <div className="glass-panel w-full md:w-80 h-[350px] md:h-full min-h-[300px] rounded-3xl p-6 flex flex-col justify-between border border-white/5 relative">
      {/* Title / Section Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <span className="font-display font-bold text-base tracking-wide text-white flex items-center gap-2">
          Lyrics
        </span>
        <button className="text-white/40 hover:text-white transition-all text-xs cursor-pointer">
          <i className="fa-solid fa-expand-arrows-alt" />
        </button>
      </div>

      {/* Lyrics lines containing layout */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-smooth select-none snap-y snap-proximity text-left"
        style={{ scrollbarWidth: 'thin' }}
      >
        {parsedLyrics.length > 0 ? (
          parsedLyrics.map((lyric, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={idx}
                className={`py-1 transform transition-all duration-300 origin-left snap-start ${
                  isActive
                    ? 'text-white font-extrabold text-sm md:text-base scale-102 opacity-100'
                    : 'text-white/40 font-medium text-xs md:text-sm hover:text-white/75 opacity-70'
                }`}
              >
                {lyric.text || '• • •'}
              </div>
            );
          })
        ) : (
          <div className="text-white/30 text-xs italic text-center pt-10">
            No lyrics available for this track.
          </div>
        )}
      </div>

      {/* Floating implicit notification helper */}
      <div className="mt-2 text-[9px] text-white/30 text-right uppercase tracking-wider flex-shrink-0">
        <i className="fa-solid fa-microphone-lines mr-1 text-brand-purple" /> Dynamic Sync Enabled
      </div>
    </div>
  );
}
