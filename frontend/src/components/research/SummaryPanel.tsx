import React from 'react';
import { DocumentSummary } from '../../types/document.js';
import { BookOpen, CheckCircle, FlaskConical, AlertTriangle, FileText } from 'lucide-react';

interface SummaryPanelProps {
  summaryData: DocumentSummary;
  documentTitle?: string;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({ summaryData, documentTitle }) => {
  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
      {documentTitle && (
        <div className="pb-3 border-b border-slate-200">
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
            Paper Summary
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">{documentTitle}</h3>
        </div>
      )}

      {/* Narrative Summary */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
          Simple Summary & Overview
        </h4>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          {summaryData.summary || 'A simple overview is available from the document text.'}
        </p>
      </div>

      {/* Key Findings */}
      {summaryData.keyFindings && summaryData.keyFindings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Key Takeaways
          </h4>
          <ul className="space-y-2">
            {summaryData.keyFindings.map((finding, index) => (
              <li
                key={index}
                className="text-xs text-slate-700 bg-emerald-50/50 border border-emerald-100 p-3 rounded-lg flex items-start gap-2.5"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-[10px]">
                  {index + 1}
                </span>
                <span className="leading-normal">{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Methodology & Limitations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
            How It Works
          </h4>
          <p className="text-xs text-slate-700 bg-blue-50/40 border border-blue-100 p-3.5 rounded-lg leading-relaxed">
            {summaryData.methodology || 'Explained based on document text.'}
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Things to Keep in Mind
          </h4>
          <p className="text-xs text-slate-700 bg-amber-50/40 border border-amber-100 p-3.5 rounded-lg leading-relaxed">
            {summaryData.limitations || 'No specific limitations noted.'}
          </p>
        </div>
      </div>

      {/* Evidence Citations */}
      {summaryData.citations && summaryData.citations.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Reference Excerpts ({summaryData.citations.length} Passages)
          </h4>
          <div className="space-y-2">
            {summaryData.citations.map((c, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 space-y-1 shadow-2xs"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span className="truncate">{c.documentName}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-600">
                    Page {c.pageNumber}
                  </span>
                </div>
                <p className="text-slate-500 italic line-clamp-3">"{c.excerpt}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
