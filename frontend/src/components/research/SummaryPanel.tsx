import React, { useState } from 'react';
import { DocumentSummary, FindingWithPage } from '../../types/document.js';
import {
  BookOpen,
  CheckCircle,
  FlaskConical,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Download,
  Database,
} from 'lucide-react';

interface SummaryPanelProps {
  summaryData: DocumentSummary;
  documentTitle?: string;
  onNavigateToPage?: (pageNum: number) => void;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summaryData,
  documentTitle,
  onNavigateToPage,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = summaryData.overview || summaryData.summary || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const text = summaryData.overview || summaryData.summary || '';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${documentTitle || 'document'}_summary.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
      {/* Header bar */}
      <div className="pb-3 border-b border-slate-200 flex items-start justify-between gap-4">
        <div>
          {summaryData.category && (
            <span className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider block">
              {summaryData.category}
            </span>
          )}
          {documentTitle && (
            <h3 className="text-base font-bold text-slate-900 mt-0.5">{documentTitle}</h3>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Copy summary"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleExport}
            className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Export markdown"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Degraded notice */}
      {summaryData.degraded && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {summaryData.degradedReason || 'Summary extracted directly from document passages.'}
          </span>
        </div>
      )}

      {/* Overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
          Overview
        </h4>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          {summaryData.overview || summaryData.summary || 'Summary generated from document text.'}
        </p>
      </div>

      {/* Key Findings */}
      {summaryData.keyFindings && summaryData.keyFindings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Key Findings & Insights
          </h4>
          <ul className="space-y-2">
            {summaryData.keyFindings.map((findingItem, index) => {
              const findingText = typeof findingItem === 'string' ? findingItem : findingItem.finding;
              const pageNum = typeof findingItem === 'object' ? (findingItem as FindingWithPage).pageNumber : undefined;

              return (
                <li
                  key={index}
                  className="text-xs text-slate-700 bg-slate-50 border border-slate-200/80 p-3 rounded-lg flex items-start justify-between gap-2.5"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0 text-[10px] mt-0.5">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed">{findingText}</span>
                  </div>

                  {pageNum && (
                    <span
                      onClick={() => onNavigateToPage?.(pageNum)}
                      className={`px-2 py-0.5 bg-brand-50 text-brand-700 rounded text-[10px] font-semibold border border-brand-200 shrink-0 ${
                        onNavigateToPage ? 'cursor-pointer hover:bg-brand-100' : ''
                      }`}
                    >
                      Page {pageNum}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Quantitative Data / Metrics Table */}
      {summaryData.importantData && summaryData.importantData.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-indigo-600" />
            Quantitative Metrics & Observations
          </h4>
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 p-3">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-semibold">
                  <th className="py-1.5 pr-3">Metric</th>
                  <th className="py-1.5 px-3">Value</th>
                  <th className="py-1.5 pl-3 text-right">Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.importantData.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2 pr-3 font-medium text-slate-800">{d.metric}</td>
                    <td className="py-2 px-3 font-bold text-brand-700 font-mono">{d.value}</td>
                    <td className="py-2 pl-3 text-right text-slate-500 font-mono text-[11px]">
                      {d.pageNumber ? `P. ${d.pageNumber}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Adaptive Sections */}
      {summaryData.sections && summaryData.sections.length > 0 && (
        <div className="space-y-3">
          {summaryData.sections.map((section, idx) => (
            <div key={idx} className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {section.title}
              </h5>
              {section.content && (
                <p className="text-xs text-slate-700 leading-relaxed">{section.content}</p>
              )}
              {section.items && (
                <ul className="pl-4 list-disc text-xs text-slate-700 space-y-1">
                  {section.items.map((it, itemIdx) => (
                    <li key={itemIdx}>{it}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Methodology & Limitations */}
      {(summaryData.methodology || summaryData.limitations) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaryData.methodology && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-blue-600" />
                Methodology
              </h4>
              <p className="text-xs text-slate-700 bg-blue-50/40 border border-blue-100 p-3.5 rounded-lg leading-relaxed">
                {summaryData.methodology}
              </p>
            </div>
          )}

          {summaryData.limitations && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Limitations & Scope
              </h4>
              <p className="text-xs text-slate-700 bg-amber-50/40 border border-amber-100 p-3.5 rounded-lg leading-relaxed">
                {summaryData.limitations}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Conclusion */}
      {summaryData.conclusion && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Conclusion</h4>
          <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed">
            {summaryData.conclusion}
          </p>
        </div>
      )}

      {/* Legal Disclaimer */}
      {summaryData.legalDisclaimer && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
          {summaryData.legalDisclaimer}
        </div>
      )}

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
