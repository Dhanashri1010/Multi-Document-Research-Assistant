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
  RefreshCw,
} from 'lucide-react';
import { Button } from '../common/Button.js';
import { exportContentToPdf } from '../../utils/pdfExport.js';

interface SummaryPanelProps {
  summaryData: DocumentSummary;
  documentTitle?: string;
  onNavigateToPage?: (pageNum: number) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summaryData,
  documentTitle,
  onNavigateToPage,
  onRegenerate,
  isRegenerating = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = summaryData.overview || summaryData.summary || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    let md = `# Executive Summary: ${documentTitle || 'Document'}\n\n`;
    if (summaryData.category) {
      md += `**Category**: ${summaryData.category}\n\n`;
    }
    md += `## 1. Overview\n${summaryData.overview || summaryData.summary || ''}\n\n`;

    if (summaryData.keyFindings && summaryData.keyFindings.length > 0) {
      md += `## 2. Key Findings & Insights\n`;
      summaryData.keyFindings.forEach((f, idx) => {
        const text = typeof f === 'string' ? f : f.finding;
        const page = typeof f === 'object' && f.pageNumber ? ` (Page ${f.pageNumber})` : '';
        md += `${idx + 1}. ${text}${page}\n`;
      });
      md += `\n`;
    }

    if (summaryData.importantData && summaryData.importantData.length > 0) {
      md += `## 3. Quantitative Metrics\n`;
      md += `| Metric | Value | Context | Page |\n| :--- | :--- | :--- | :--- |\n`;
      summaryData.importantData.forEach((d) => {
        md += `| ${d.metric} | ${d.value} | ${d.context || '—'} | ${d.pageNumber ? `P. ${d.pageNumber}` : '—'} |\n`;
      });
      md += `\n`;
    }

    if (summaryData.methodology) {
      md += `## 4. Methodology\n${summaryData.methodology}\n\n`;
    }

    if (summaryData.limitations) {
      md += `## 5. Limitations & Boundary Conditions\n${summaryData.limitations}\n\n`;
    }

    if (summaryData.conclusion) {
      md += `## 6. Takeaway & Practical Significance\n${summaryData.conclusion}\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(documentTitle || 'document').replace(/[^a-zA-Z0-9_-]/g, '_')}_summary.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    let md = `# Executive Research Summary\n\n`;
    if (documentTitle) {
      md += `**Document**: ${documentTitle}\n\n`;
    }
    if (summaryData.category) {
      md += `**Category**: ${summaryData.category}\n\n`;
    }
    md += `## 1. Overview\n${summaryData.overview || summaryData.summary || ''}\n\n`;

    if (summaryData.keyFindings && summaryData.keyFindings.length > 0) {
      md += `## 2. Key Findings & Insights\n`;
      summaryData.keyFindings.forEach((f, idx) => {
        const text = typeof f === 'string' ? f : f.finding;
        const page = typeof f === 'object' && f.pageNumber ? ` (Page ${f.pageNumber})` : '';
        md += `- ${text}${page}\n`;
      });
      md += `\n`;
    }

    if (summaryData.methodology) {
      md += `## 3. Methodology & System Architecture\n${summaryData.methodology}\n\n`;
    }

    if (summaryData.limitations) {
      md += `## 4. Limitations & Boundary Conditions\n${summaryData.limitations}\n\n`;
    }

    if (summaryData.conclusion) {
      md += `## 5. Practical Significance & Takeaways\n${summaryData.conclusion}\n\n`;
    }

    exportContentToPdf({
      title: documentTitle ? `Summary: ${documentTitle}` : 'Executive Research Summary',
      subtitle: summaryData.category ? `Category: ${summaryData.category}` : undefined,
      contentMarkdown: md,
    });
  };

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
      {/* Top Header & Actions Toolbar */}
      <div className="pb-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {summaryData.category && (
            <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block">
              {summaryData.category}
            </span>
          )}
          {documentTitle && (
            <h3 className="text-base font-bold text-slate-900 mt-0.5 leading-snug">{documentTitle}</h3>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              isLoading={isRegenerating}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              title="Regenerate summary with latest AI synthesis"
            >
              Regenerate
            </Button>
          )}

          <button
            onClick={handleCopy}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Copy summary to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleExport}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200"
            title="Export markdown report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export MD</span>
          </button>

          <button
            onClick={handleExportPdf}
            className="px-2.5 py-1 text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg flex items-center gap-1.5 transition-colors border border-purple-200"
            title="Export formatted PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Degraded Notice with Retry */}
      {summaryData.degraded && (
        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {summaryData.degradedReason || 'Summary generated directly from indexed document excerpts.'}
            </span>
          </div>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline shrink-0"
            >
              Retry AI Synthesis
            </button>
          )}
        </div>
      )}

      {/* 1. Overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
          Executive Overview
        </h4>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/80">
          {summaryData.overview || summaryData.summary || 'Summary generated from document text.'}
        </p>
      </div>

      {/* 2. Key Findings & Insights */}
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

      {/* 3. Quantitative Data / Metrics Table */}
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
                  <th className="py-1.5 px-3">Context / Baseline</th>
                  <th className="py-1.5 pl-3 text-right">Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.importantData.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2 pr-3 font-semibold text-slate-800">{d.metric}</td>
                    <td className="py-2 px-3 font-bold text-brand-700 font-mono">{d.value}</td>
                    <td className="py-2 px-3 text-slate-600">{d.context || '—'}</td>
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

      {/* 4. Adaptive Domain Sections */}
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

      {/* 5. Methodology & Limitations */}
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

      {/* 6. Conclusion */}
      {summaryData.conclusion && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Takeaway & Practical Significance
          </h4>
          <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 leading-relaxed">
            {summaryData.conclusion}
          </p>
        </div>
      )}

      {/* 7. Legal Disclaimer */}
      {summaryData.legalDisclaimer && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
          {summaryData.legalDisclaimer}
        </div>
      )}

      {/* 8. Evidence Citations */}
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
                <p className="text-slate-500 italic line-clamp-3">&quot;{c.excerpt}&quot;</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
