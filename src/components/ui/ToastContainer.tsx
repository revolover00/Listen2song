import React from 'react';
import { ToastMessage } from '../../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let bgStyle = 'bg-[#181818] border-white/5 text-white';
        let icon = 'fa-circle-info text-blue-400';

        if (toast.type === 'success') {
          bgStyle = 'bg-black/90 border-brand-purple/20 text-white';
          icon = 'fa-circle-check text-brand-purple';
        } else if (toast.type === 'error') {
          bgStyle = 'bg-red-950/90 border-red-500/20 text-red-100';
          icon = 'fa-circle-exclamation text-red-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border flex items-start gap-3 shadow-xl transform transition-transform duration-300 animate-slide-in-right glass-panel ${bgStyle}`}
          >
            <span className="shrink-0 mt-0.5">
              <i className={`fa-solid ${icon}`} />
            </span>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="shrink-0 text-white/40 hover:text-white transition-colors cursor-pointer text-[10px]"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
