import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Loading residences & availability...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <Loader2 className="w-8 h-8 text-brand-700 animate-spin mb-3" />
      <p className="text-sm font-medium text-stone-600">{label}</p>
    </div>
  );
}
