import React from 'react';
import { ToastMessage } from '../../types';
import { Info, CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none animate-fadeIn">
      {toasts.map((toast) => {
        let bgStyle = 'bg-[#181818] border-white/5 text-white';
        let IconComponent = Info;
        let iconColor = 'text-blue-400';

        if (toast.type === 'success') {
          bgStyle = 'bg-black/90 border-brand-purple/20 text-white';
          IconComponent = CheckCircle2;
          iconColor = 'text-brand-purple';
        } else if (toast.type === 'error') {
          bgStyle = 'bg-red-950/90 border-red-500/20 text-red-100';
          IconComponent = AlertCircle;
          iconColor = 'text-red-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border flex items-start gap-3 shadow-xl transform transition-transform duration-300 animate-slide-in-right glass-panel ${bgStyle}`}
          >
            <span className="shrink-0 mt-0.5">
              <IconComponent className={`h-4 w-4 ${iconColor}`} />
            </span>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="shrink-0 text-white/40 hover:text-white transition-colors cursor-pointer p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
