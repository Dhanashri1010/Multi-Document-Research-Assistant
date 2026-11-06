import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { ICitation } from '../../types/research.js';
import { PdfViewerModal } from '../common/PdfViewerModal.js';

interface SourceCitationProps {
  citations: ICitation[];
}

export const SourceCitation: React.FC<SourceCitationProps> = ({ citations }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activePdf, setActivePdf] = useState<{
    docId: string;
    docName: string;
    page: number;
  } | null>(null);

  if (!citations || citations.length === 0) return null;

  const unverifiedCount = citations.filter((c) => c.verified === false).length;

  return (
    <>
      <div className="mt-4 pt-3 border-t border-slate-200/80">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-brand-600" />
            Retrieved Evidence & Citations ({citations.length})
          </span>
          {unverifiedCount > 0 && (
            <span
              title="Some citations could not be verified with high semantic confidence"
              className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold flex items-center gap-1 border border-amber-300/60"
            >
              <AlertCircle className="w-3 h-3 text-amber-600" />
              {unverifiedCount} unverified citation{unverifiedCount > 1 ? 's' : ''} flagged
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {citations.map((cite, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <div
                key={index}
                className={`p-2.5 rounded-lg border transition-all text-xs ${
                  cite.verified === false
                    ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
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
                    {cite.verified !== false ? (
                      <span
                        title="Citation verified against claim"
                        className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] flex items-center gap-0.5"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        verified
                      </span>
                    ) : (
                      <span
                        title="Low evidence overlap"
                        className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] flex items-center gap-0.5"
                      >
                        <AlertCircle className="w-3 h-3 text-amber-600" />
                        unverified
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
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                    <div className="text-slate-600 italic bg-slate-50/70 p-2 rounded text-[11px] leading-relaxed">
                      "{cite.excerpt}"
                    </div>
                    {cite.documentId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePdf({
                            docId: cite.documentId,
                            docName: cite.documentName,
                            page: cite.pageNumber,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium text-xs border border-brand-200/80 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-brand-600" />
                        <span>Open in PDF Viewer at Page {cite.pageNumber}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activePdf && (
        <PdfViewerModal
          isOpen={Boolean(activePdf)}
          onClose={() => setActivePdf(null)}
          documentId={activePdf.docId}
          documentName={activePdf.docName}
          pageNumber={activePdf.page}
        />
      )}
    </>
  );
};
