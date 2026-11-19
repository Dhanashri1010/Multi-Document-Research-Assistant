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
      const isCooldown =
        message &&
        (message.toLowerCase().includes('waiting for gemini') ||
          message.toLowerCase().includes('rate limit') ||
          message.toLowerCase().includes('retrying'));

      let label = 'Preparing';
      if (isCooldown) {
        const secMatch = message?.match(/(\d+)\s*s/);
        const secText = secMatch ? `${secMatch[1]}s` : 'waiting';
        if (typeof embeddedChunkCount === 'number' && typeof totalChunkCount === 'number' && totalChunkCount > 0) {
          label = `Cooldown (${secText}) · ${embeddedChunkCount}/${totalChunkCount}`;
        } else {
          label = secMatch ? `Rate limit cooldown (${secMatch[1]}s)` : 'Rate limit cooldown';
        }
      } else if (typeof embeddedChunkCount === 'number' && typeof totalChunkCount === 'number' && totalChunkCount > 0) {
        label = `Embedding ${embeddedChunkCount}/${totalChunkCount}`;
      } else if (message) {
        label = message.length > 28 ? message.slice(0, 25) + '...' : message;
      }

      const colorClass = isCooldown
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';
      const iconColor = isCooldown ? 'text-amber-600' : 'text-blue-600';

      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 border ${colorClass}`}
          title={message || label}
        >
          {showIcon && <Loader2 className={`w-3.5 h-3.5 ${iconColor} animate-spin`} />}
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
