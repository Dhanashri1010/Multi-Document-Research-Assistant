import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';
import { DocumentStatus } from '../../types/document.js';

export interface ProcessingStatusProps {
  status: DocumentStatus;
  showIcon?: boolean;
  message?: string;
  embeddedChunkCount?: number;
  totalChunkCount?: number;
}

export const ProcessingStatusBadge: React.FC<ProcessingStatusProps> = ({
  status,
  showIcon = true,
  message,
  embeddedChunkCount,
  totalChunkCount,
}) => {
  switch (status) {
    case 'ready':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
          Ready
        </span>
      );
    case 'processing': {
      let label = 'Preparing';
      if (typeof embeddedChunkCount === 'number' && typeof totalChunkCount === 'number' && totalChunkCount > 0) {
        label = `Embedding ${embeddedChunkCount}/${totalChunkCount}`;
      } else if (message) {
        label = message.length > 28 ? message.slice(0, 25) + '...' : message;
      }

      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
          title={message || label}
        >
          {showIcon && <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />}
          {label}
        </span>
      );
    }
    case 'uploaded':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          {showIcon && <Clock className="w-3.5 h-3.5 text-amber-600" />}
          Uploaded
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          {showIcon && <AlertCircle className="w-3.5 h-3.5 text-rose-600" />}
          Failed
        </span>
      );
    default:
      return null;
  }
};
