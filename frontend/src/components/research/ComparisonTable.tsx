import React, { useState } from 'react';
import { ComparisonResult } from '../../types/research.js';
import {
  Table,
  CheckCircle,
  GitCompare,
  AlertTriangle,
  Lightbulb,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  RotateCcw,
  Globe,
  Loader2,
  FileDown,
} from 'lucide-react';
import { NlpService } from '../../services/nlpService.js';
import { exportContentToPdf } from '../../utils/pdfExport.js';

export function sanitizeDegradedReason(reason?: string): string {
  if (!reason) {
    return 'Generative cross-document comparison was temporarily unavailable. Analysis was safely compiled directly from indexed passages.';
  }
  if (
    /json|syntaxerror|position \d+|unterminated|unexpected token|failed to parse|econnrefused|at line \d+/i.test(
      reason
    )
  ) {
    return 'The AI model response was interrupted during generation. Document excerpts and verified passages have been retrieved directly from your indexed papers.';
  }
  return reason;
}

interface ComparisonTableProps {
  comparison: ComparisonResult;
  onRetry?: () => void;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ comparison, onRetry }) => {
  const [activeTab, setActiveTab] = useState<
    'matrix' | 'similarities' | 'differences' | 'findings' | 'limitations' | 'citations'
  >('matrix');

  const [expandedExcerpt, setExpandedExcerpt] = useState<number | null>(null);
  const [targetLang, setTargetLang] = useState<string>('');
  const [translating, setTranslating] = useState<boolean>(false);
  const [translationProvider, setTranslationProvider] = useState<string | null>(null);
  const [translatedText, setTranslatedText] = useState<string | null>(null);

  const buildMarkdownReport = () => {
    let md = `# Cross-Document Comparative Analysis\n\n`;
    if (comparison.focusTopic) {
      md += `**Focus Topic**: ${comparison.focusTopic}\n\n`;
    }
    md += `**Generated**: ${new Date().toLocaleString()}\n`;
    md += `**Documents Compared (${comparison.documents.length})**:\n`;
    comparison.documents.forEach((d) => {
      const pageInfo = d.pageCount && d.pageCount > 0 ? `${d.pageCount} pages` : 'Word document';
      md += `- **${d.name}** (${pageInfo})\n`;
    });
    md += `\n---\n\n`;

    if (comparison.degraded) {
      md += `> **Notice**: Synthesized in grounded fallback mode (${comparison.degradedReason || 'Extracted excerpts'})\n\n`;
    }

    md += `## 1. Structured Comparison Matrix (10 Dimensions)\n\n`;
    const docNames = comparison.documents.map((d) => d.name);
    md += `| Evaluation Dimension | ${docNames.join(' | ')} |\n`;
    md += `| :--- | ${docNames.map(() => ':---').join(' | ')} |\n`;
    comparison.matrix.forEach((dim) => {
      const row = comparison.documents.map((doc) => {
        const item = dim.values.find((v) => v.documentId === doc.id || v.documentName === doc.name);
        const findingText = item?.finding || 'Not reported in the provided document';
        const pageRef = item?.pageNumber
          ? ` *(p. ${item.pageNumber})*`
          : item?.heading || item?.section
          ? ` *(${item.heading || item.section})*`
          : '';
        return `${findingText.replace(/\|/g, '\\|')}${pageRef}`;
      });
      md += `| **${dim.dimension}** | ${row.join(' | ')} |\n`;
    });
    md += `\n`;

    md += `## 2. Shared Methodologies & Similarities\n\n`;
    comparison.similarities.forEach((s, idx) => {
      md += `${idx + 1}. ${s}\n`;
    });
    md += `\n`;

    md += `## 3. Key Differences & Contrasts\n\n`;
    comparison.differences.forEach((d, idx) => {
      md += `${idx + 1}. ${d}\n`;
    });
    md += `\n`;

    md += `## 4. Key Findings & Insights\n\n`;
    comparison.keyFindings.forEach((f, idx) => {
      md += `${idx + 1}. ${f}\n`;
    });
    md += `\n`;

    md += `## 5. Identified Limitations\n\n`;
    comparison.limitations.forEach((l, idx) => {
      md += `${idx + 1}. ${l}\n`;
    });
    md += `\n`;

    if (comparison.citations && comparison.citations.length > 0) {
      md += `## 6. Citations & Grounded Evidence\n\n`;
      comparison.citations.forEach((c, idx) => {
        const loc = c.pageNumber
          ? `Page ${c.pageNumber}`
          : `Section: ${c.heading || c.section || 'Content'}${c.paragraphNumber ? `, Para ${c.paragraphNumber}` : ''}`;
        md += `${idx + 1}. **${c.documentName}** (${loc}): "${c.excerpt}"\n`;
      });
    }

    return md;
  };

  const exportComparisonMarkdown = () => {
    const md = buildMarkdownReport();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison_analysis_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportComparisonPdf = () => {
    const md = buildMarkdownReport();
    exportContentToPdf({
      title: comparison.focusTopic ? `Comparison: ${comparison.focusTopic}` : 'Cross-Document Comparative Analysis',
      subtitle: `Comparing ${comparison.documents.length} research papers`,
      contentMarkdown: md,
    });
  };

  const handleTranslate = async (lang: string) => {
    setTargetLang(lang);
    if (!lang) {
      setTranslatedText(null);
      setTranslationProvider(null);
      return;
    }
    setTranslating(true);
    try {
      const summaryToTranslate = [
        `Key Findings:\n${comparison.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}`,
        `Similarities:\n${comparison.similarities.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
        `Differences:\n${comparison.differences.map((d, i) => `${i + 1}. ${d}`).join('\n')}`,
      ].join('\n\n');

      const res = await NlpService.translateText({
        text: summaryToTranslate,
        targetLanguage: lang,
      });
      setTranslatedText(res.translatedText);
      setTranslationProvider(
        res.provider === 'google_cloud'
          ? 'Google Cloud Translation'
          : res.provider === 'gemini'
          ? 'Gemini Multilingual'
          : 'Local dictionary translation'
      );
    } catch (err: any) {
      console.error('Comparison translation failed:', err);
    } finally {
      setTranslating(false);
    }
  };

  const tabs = [
    { id: 'matrix', label: 'Comparison Matrix', icon: Table, count: comparison.matrix.length },
    { id: 'similarities', label: 'Similarities', icon: CheckCircle, count: comparison.similarities.length },
    { id: 'differences', label: 'Differences', icon: GitCompare, count: comparison.differences.length },
    { id: 'findings', label: 'Key Findings', icon: Lightbulb, count: comparison.keyFindings.length },
    { id: 'limitations', label: 'Limitations', icon: AlertTriangle, count: comparison.limitations.length },
    { id: 'citations', label: 'Source Evidence', icon: FileText, count: comparison.citations.length },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Degraded / Fallback Banner */}
      {comparison.degraded && (
        <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-amber-900">Passage-Grounded Fallback Analysis</span>
              <p className="mt-0.5 text-amber-800 leading-relaxed">
                {sanitizeDegradedReason(comparison.degradedReason)}
              </p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-amber-900 hover:bg-amber-100 border border-amber-300 transition-colors shrink-0 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Comparison</span>
            </button>
          )}
        </div>
      )}

      {/* Header Toolbar */}
      <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/70">
        <div>
          <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider">
            Academic Meta-Analysis
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            {comparison.focusTopic ? `Focus: "${comparison.focusTopic}"` : 'Cross-Document Comparative Analysis'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparing {comparison.documents.length} research papers across 10 academic dimensions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportComparisonMarkdown}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:text-brand-700 hover:bg-brand-50 border border-slate-300 transition-colors shrink-0 shadow-2xs"
            title="Export complete comparison to Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5 text-brand-600" />
            <span>Export MD</span>
          </button>

          <button
            type="button"
            onClick={exportComparisonPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors shrink-0 shadow-2xs"
            title="Export formatted comparison PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-purple-600" />
            <span>Export PDF</span>
          </button>

          {/* Translation selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            {translating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-slate-500" />
            )}
            <select
              value={targetLang}
              onChange={(e) => handleTranslate(e.target.value)}
              disabled={translating}
              className="bg-transparent text-slate-700 font-medium focus:outline-none cursor-pointer"
              title="Translate comparison findings to another language"
            >
              <option value="">Translate...</option>
              <option value="hi">Hindi (हिन्दी)</option>
              <option value="mr">Marathi (मराठी)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
              <option value="de">German (Deutsch)</option>
            </select>
          </div>

          {/* Tab Navigation Pills */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-brand-100 text-brand-700' : 'bg-slate-300 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Translation Overlay Card */}
      {translatedText && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-purple-50/60 border border-purple-200 text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-100">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-purple-900">
                Translated Findings ({targetLang.toUpperCase()})
              </span>
              {translationProvider && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700">
                  {translationProvider}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setTranslatedText(null);
                setTargetLang('');
              }}
              className="text-purple-600 hover:text-purple-800 font-semibold"
            >
              Clear
            </button>
          </div>
          <div className="whitespace-pre-line text-slate-700 leading-relaxed max-h-48 overflow-y-auto">
            {translatedText}
          </div>
        </div>
      )}

      {/* Tab Panels */}
      <div className="p-6">
        {/* 1. Comparison Matrix Table */}
        {activeTab === 'matrix' && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="py-3.5 px-4 text-xs font-bold text-slate-600 uppercase tracking-wider w-1/4 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                    Evaluation Dimension
                  </th>
                  {comparison.documents.map((doc) => (
                    <th
                      key={doc.id}
                      className="py-3.5 px-4 text-xs font-bold text-slate-800 uppercase tracking-wider"
                    >
                      <div className="truncate font-bold text-brand-700" title={doc.name}>
                        {doc.name}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal lowercase">
                        {doc.pageCount && doc.pageCount > 0 ? `${doc.pageCount} pages` : 'Word document'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {comparison.matrix.length === 0 ? (
                  <tr>
                    <td
                      colSpan={comparison.documents.length + 1}
                      className="py-8 px-4 text-center text-xs text-slate-500 italic"
                    >
                      No comparison dimensions available. Please see the Source Evidence tab for document passages.
                    </td>
                  </tr>
                ) : (
                  comparison.matrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-800 align-top bg-white sticky left-0 z-10 border-r border-slate-200">
                        {row.dimension}
                      </td>
                      {comparison.documents.map((doc) => {
                        const item = row.values.find(
                          (v) => v.documentId === doc.id || v.documentName === doc.name
                        );
                        const rawFinding = (item?.finding || '').toLowerCase();
                        const isNotFound =
                          !item?.finding ||
                          rawFinding.includes('not reported') ||
                          rawFinding.includes('not found') ||
                          rawFinding.includes('not mentioned') ||
                          rawFinding.includes('not stated') ||
                          rawFinding.includes('not available');

                        return (
                          <td key={doc.id} className="py-3.5 px-4 text-xs align-top">
                            {isNotFound ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 italic text-[11px] border border-slate-200/80">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Not reported in document
                              </span>
                            ) : (
                              <div className="space-y-1.5">
                                <p className="text-slate-700 leading-relaxed">{item.finding}</p>
                                {item.pageNumber ? (
                                  <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 font-semibold border border-brand-200">
                                    Page {item.pageNumber}
                                  </span>
                                ) : (item?.heading || item?.section) ? (
                                  <span className="inline-block text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                                    {item.heading || item.section}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. Similarities Tab */}
        {activeTab === 'similarities' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Common Methodologies & Shared Insights
            </h4>
            {comparison.similarities.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No significant similarities reported.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {comparison.similarities.map((sim, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-slate-800 flex items-start gap-3 shadow-2xs"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{sim}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. Differences Tab */}
        {activeTab === 'differences' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Key Methodological & Empirical Divergences
            </h4>
            {comparison.differences.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No significant differences reported.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {comparison.differences.map((diff, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-slate-800 flex items-start gap-3 shadow-2xs"
                  >
                    <GitCompare className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{diff}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Key Findings Tab */}
        {activeTab === 'findings' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Primary Conclusions & Breakthrough Claims
            </h4>
            <div className="space-y-2.5">
              {comparison.keyFindings.map((finding, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-start gap-3"
                >
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{finding}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Reported Limitations Tab */}
        {activeTab === 'limitations' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Authors&apos; Stated Constraints & Future Research Directions
            </h4>
            <div className="space-y-2.5">
              {comparison.limitations.map((limit, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-3"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{limit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Citations Tab */}
        {activeTab === 'citations' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Grounded Excerpt Corpus ({comparison.citations.length} passages analyzed)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {comparison.citations.map((cite, idx) => {
                const isExpanded = expandedExcerpt === idx;
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-2 hover:border-slate-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
                      <span className="truncate pr-2 font-bold">{cite.documentName}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-600 shrink-0">
                        {cite.pageNumber
                          ? `p. ${cite.pageNumber}`
                          : cite.heading || cite.section || 'section'}
                      </span>
                    </div>

                    <p className={`text-slate-600 italic leading-relaxed ${isExpanded ? '' : 'line-clamp-3'}`}>
                      &quot;{cite.excerpt}&quot;
                    </p>

                    <button
                      onClick={() => setExpandedExcerpt(isExpanded ? null : idx)}
                      className="text-[11px] text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          Show less <ChevronUp className="w-3 h-3" />
                        </>
                      ) : (
                        <>
                          Expand excerpt <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
