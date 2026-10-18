'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3.5 rounded-xl shadow-lg border max-w-sm animate-toast-in ${
        type === 'success'
          ? 'bg-success-soft border-success-border'
          : 'bg-danger-soft border-danger-border'
      }`}
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
      )}
      <p className={`text-sm flex-1 ${type === 'success' ? 'text-green-900' : 'text-red-800'}`}>
        {message}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="text-pine/40 hover:text-pine transition-colors cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
