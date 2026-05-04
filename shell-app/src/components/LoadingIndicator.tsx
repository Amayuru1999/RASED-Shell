import React from 'react';

interface Props {
  message?: string;
}

export function LoadingIndicator({ message = 'Loading...' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-navy-700/20 border-t-navy-700 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-gold-500 animate-pulse" />
        </div>
      </div>
      <p className="text-sm text-slate-500 font-medium">{message}</p>
    </div>
  );
}
