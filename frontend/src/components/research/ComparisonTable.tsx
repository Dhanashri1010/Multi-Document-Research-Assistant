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
} from 'lucide-react';

interface ComparisonTableProps {
  comparison: ComparisonResult;
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ comparison }) => {
  const [activeTab, setActiveTab] = useState<
    'matrix' | 'similarities' | 'differences' | 'findings' | 'limitations' | 'citations'
  >('matrix');

  const [expandedExcerpt, setExpandedExcerpt] = useState<number | null>(null);

  const tabs = [
    { id: 'matrix', label: 'Comparison Matrix', icon: Table },
    { id: 'similarities', label: 'Similarities', icon: CheckCircle, count: comparison.similarities.length },
    { id: 'differences', label: 'Differences', icon: GitCompare, count: comparison.differences.length },
    { id: 'findings', label: 'Key Findings', icon: Lightbulb, count: comparison.keyFindings.length },
    { id: 'limitations', label: 'Limitations', icon: AlertTriangle, count: comparison.limitations.length },
    { id: 'citations', label: 'Source Evidence', icon: FileText, count: comparison.citations.length },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Degraded / Fallback Banner */}
      {comparison.degraded && (
        <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-900 flex items-start gap-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-amber-900">Degraded / Grounded Fallback Answer</span>
            <p className="mt-0.5 text-amber-800">
              {comparison.degradedReason ||
                'Generative multi-document synthesis was temporarily unavailable or timed out. Cross-paper analysis was synthesized directly from grounded document excerpts.'}
            </p>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/60">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Comparative Synthesis
          </span>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            {comparison.focusTopic ? `Focus: "${comparison.focusTopic}"` : 'Comprehensive Multi-Paper Cross-Analysis'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparing {comparison.documents.length} research papers based on extracted grounded evidence.
          </p>
        </div>

        {/* Tab pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1 rounded-lg">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
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
                      isActive ? 'bg-slate-100 text-slate-700' : 'bg-slate-300 text-slate-700'
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

      {/* Tab Content */}
      <div className="p-6">
        {/* 1. Comparison Matrix Table */}
        {activeTab === 'matrix' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">
                    Dimension
                  </th>
                  {comparison.documents.map((doc) => (
                    <th
                      key={doc.id}
                      className="py-3 px-4 text-xs font-bold text-slate-800 uppercase tracking-wider"
                    >
                      <div className="truncate font-bold text-brand-700" title={doc.name}>
                        {doc.name}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal lowercase">
                        {doc.pageCount} pages
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-800 align-top bg-slate-50/30">
                        {row.dimension}
                      </td>
                      {comparison.documents.map((doc) => {
                        const item = row.values.find(
                          (v) => v.documentId === doc.id || v.documentName === doc.name
                        );
                        const isNotFound =
                          !item?.finding ||
                          item.finding.toLowerCase().includes('not found') ||
                          item.finding.toLowerCase().includes('not mentioned');

                        return (
                          <td key={doc.id} className="py-3.5 px-4 text-xs align-top">
                            {isNotFound ? (
                              <span className="inline-block px-2 py-1 rounded bg-slate-100 text-slate-500 italic text-[11px] border border-slate-200">
                                Not found in provided document
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <p className="text-slate-700 leading-relaxed">{item.finding}</p>
                                {item.pageNumber && (
                                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">
                                    Page {item.pageNumber}
                                  </span>
                                )}
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
                    className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-slate-800 flex items-start gap-3"
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
                    className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-800 flex items-start gap-3"
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
            <div className="space-y-2">
              {comparison.keyFindings.map((finding, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 flex items-start gap-2.5"
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
              Authors' Stated Constraints & Future Research Directions
            </h4>
            <div className="space-y-2">
              {comparison.limitations.map((limit, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-amber-50/50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5"
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
                    className="p-3 rounded-lg bg-white border border-slate-200 text-xs space-y-2 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-800">
                      <span className="truncate pr-2">{cite.documentName}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-slate-600 shrink-0">
                        p. {cite.pageNumber}
                      </span>
                    </div>

                    <p className={`text-slate-600 italic ${isExpanded ? '' : 'line-clamp-3'}`}>
                      "{cite.excerpt}"
                    </p>

                    <button
                      onClick={() => setExpandedExcerpt(isExpanded ? null : idx)}
                      className="text-[11px] text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center gap-1"
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
