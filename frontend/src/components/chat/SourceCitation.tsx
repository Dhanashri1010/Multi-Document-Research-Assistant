import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { ICitation } from '../../types/research.js';

interface SourceCitationProps {
  citations: ICitation[];
}

export const SourceCitation: React.FC<SourceCitationProps> = ({ citations }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-slate-200/80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-brand-600" />
          Retrieved Evidence & Citations ({citations.length})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {citations.map((cite, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={index}
              className="p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all text-xs"
            >
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
              >
                <div className="flex items-center gap-2 truncate pr-1">
                  <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-brand-200">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-slate-800 truncate" title={cite.documentName}>
                    {cite.documentName}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">
                    p. {cite.pageNumber}
                  </span>
                  {cite.score && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10px]">
                      {Math.round(cite.score * 100)}%
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 text-slate-600 italic bg-slate-50/70 p-2 rounded text-[11px] leading-relaxed">
                  "{cite.excerpt}"
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
