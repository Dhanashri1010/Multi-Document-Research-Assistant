import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading workspace data...',
  size = 'md',
}) => {
  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      <Loader2 className={`${spinnerSizes[size]} animate-spin text-brand-600 mb-3`} />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
};
