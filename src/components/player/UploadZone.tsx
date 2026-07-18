import React, { useRef, useState } from 'react';
import { UploadCloud, Disc, Music, FileArchive } from 'lucide-react';

interface UploadZoneProps {
  onMp3Upload: (files: FileList) => Promise<void>;
  onZipUpload: (file: File) => Promise<void>;
  isProcessing: boolean;
  processProgress: number;
}

export function UploadZone({
  onMp3Upload,
  onZipUpload,
  isProcessing,
  processProgress
}: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = e.dataTransfer.files;
      await routeUpload(files);
    }
  };

  const routeUpload = async (files: FileList) => {
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
      await onZipUpload(files[0]);
    } else {
      // Treat as batch of MP3s
      await onMp3Upload(files);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onMp3Upload(e.target.files);
    }
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onZipUpload(e.target.files[0]);
    }
  };

  return (
    <div className="flex-1 bg-neutral-900/60 rounded-3xl p-6 md:p-10 flex flex-col justify-center items-center h-[350px] md:h-full min-h-[300px] border border-white/5 relative">
      
      {/* Invisible inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm,.opus"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={zipInputRef}
        onChange={handleZipChange}
        accept=".zip"
        className="hidden"
      />

      {isProcessing ? (
        <div className="text-center w-full max-w-xs space-y-4">
          <div className="relative inline-block">
            <UploadCloud className="h-12 w-12 text-brand-purple animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-purple-dark opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-purple"></span>
            </span>
          </div>
          <h3 className="text-base font-bold text-white uppercase tracking-wider">Unpacking Archive...</h3>
          <p className="text-xs text-white/40">Reading files cleanly inside browser memory</p>
          
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-brand-purple h-full transition-all duration-300" 
              style={{ width: `${processProgress}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-brand-purple z-10 block">
            {processProgress}%
          </span>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full max-w-xl p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
            isDragOver 
              ? 'border-brand-purple bg-brand-purple/5 scale-101' 
              : 'border-white/10 hover:border-white/20 bg-black/20'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4 text-[#8C8C8C] group-hover:text-white transition-all">
            <Disc className="h-6 w-6 animate-spin-slow text-brand-purple" />
          </div>

          <h3 className="text-sm md:text-base font-bold text-white mb-2">
            Drag & Drop or Click to Upload Music
          </h3>
          <p className="text-xs text-white/40 max-w-sm mb-4 leading-relaxed">
            Upload individual <span className="text-white">audio files</span> (MP3, WAV, M4A, FLAC, OGG, etc.) or drag in a <span className="text-white">ZIP archive</span> containing multiple songs. Everything stays private inside your browser container.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="cursor-pointer flex-1 bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple text-xs font-bold py-2.5 px-4 rounded-xl transition-all border border-brand-purple/20 flex items-center justify-center gap-2"
            >
              <Music className="h-4.5 w-4.5" /> Select Audio
            </button>
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                zipInputRef.current?.click();
              }}
              className="cursor-pointer flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2"
            >
              <FileArchive className="h-4.5 w-4.5" /> Select ZIP
            </button>
          </div>
          
          <span className="text-[10px] text-white/30 uppercase tracking-widest mt-6">
            EMOTION CENTER DEPLOYMENT
          </span>
        </div>
      )}

    </div>
  );
}
