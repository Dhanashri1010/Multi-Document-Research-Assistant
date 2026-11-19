import React, { useState } from 'react';
import { Layers, Sparkles, BarChart2, Info, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { NlpService, TopicModelingResult } from '../../services/nlpService.js';
import { IDocument } from '../../types/document.js';

interface TopicModelingTabProps {
  documents: IDocument[];
}

const CLUSTER_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-700', hex: '#3b82f6', border: 'border-blue-200', light: 'bg-blue-50' },
  { bg: 'bg-emerald-500', text: 'text-emerald-700', hex: '#10b981', border: 'border-emerald-200', light: 'bg-emerald-50' },
  { bg: 'bg-purple-500', text: 'text-purple-700', hex: '#8b5cf6', border: 'border-purple-200', light: 'bg-purple-50' },
  { bg: 'bg-amber-500', text: 'text-amber-700', hex: '#f59e0b', border: 'border-amber-200', light: 'bg-amber-50' },
  { bg: 'bg-rose-500', text: 'text-rose-700', hex: '#f43f5e', border: 'border-rose-200', light: 'bg-rose-50' },
  { bg: 'bg-cyan-500', text: 'text-cyan-700', hex: '#06b6d4', border: 'border-cyan-200', light: 'bg-cyan-50' },
];

export const TopicModelingTab: React.FC<TopicModelingTabProps> = ({ documents }) => {
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedK, setSelectedK] = useState<number | 'auto'>('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TopicModelingResult | null>(null);
  const [aiNaming, setAiNaming] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{
    id: string;
    documentName: string;
    textSnippet: string;
    cluster: number;
    x: number;
    y: number;
  } | null>(null);

  const readyDocs = documents.filter((d) => d.status === 'ready');

  const toggleDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleRunTopicModeling = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await NlpService.getTopics({
        documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        k: selectedK === 'auto' ? undefined : selectedK,
        generateAiTitles: false,
        forceRefresh,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Topic modeling failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAiTitles = async () => {
    if (!result) return;
    setAiNaming(true);
    setError(null);
    try {
      const data = await NlpService.getTopics({
        documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        k: result.k,
        generateAiTitles: true,
        forceRefresh: true,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to generate AI topic titles.');
    } finally {
      setAiNaming(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-600" />
              <h3 className="text-base font-bold text-slate-800">
                Cross-Document Topic Modeling (CO3)
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                K-Means + c-TF-IDF + PCA
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Clusters existing 768d vector embeddings across research documents. Evaluates optimal <em>k</em> using Silhouette scores, extracts keywords using Class-based TF-IDF (c-TF-IDF), and projects embeddings to 2D using Principal Component Analysis (PCA).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleRunTopicModeling(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Clustering Chunks...</span>
                </>
              ) : (
                <>
                  <Layers className="w-4 h-4" />
                  <span>Run Topic Modeling</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Controls: Documents & K selection */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Select Documents ({selectedDocIds.length === 0 ? 'All Documents' : `${selectedDocIds.length} Selected`})
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedDocIds([])}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  selectedDocIds.length === 0
                    ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Documents ({readyDocs.length})
              </button>
              {readyDocs.map((doc) => {
                const isSelected = selectedDocIds.includes(doc._id);
                return (
                  <button
                    key={doc._id}
                    type="button"
                    onClick={() => toggleDoc(doc._id)}
                    className={`text-xs px-2.5 py-1 rounded-md border transition-colors truncate max-w-xs ${
                      isSelected
                        ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    title={doc.title || doc.originalName}
                  >
                    {doc.title || doc.originalName}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Number of Topics (k)
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedK('auto')}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  selectedK === 'auto'
                    ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Auto (Silhouette Optimal)
              </button>
              {[2, 3, 4, 5, 6].map((kVal) => (
                <button
                  key={kVal}
                  type="button"
                  onClick={() => setSelectedK(kVal)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    selectedK === kVal
                      ? 'bg-brand-50 border-brand-300 text-brand-700 font-semibold'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  k = {kVal}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Auto evaluates k ∈ [2, 6] using the intra-cluster vs nearest-cluster silhouette metric.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}
      </div>

      {result && (
        <>
          {/* Metrics & AI Title Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Optimal k</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{result.k} Topics</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Across {result.totalChunksAnalyzed} chunks</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Silhouette Score</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {result.silhouetteScore.toFixed(3)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Scale -1 to +1 (higher = tighter)</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">c-TF-IDF Coherence</div>
              <div className="text-2xl font-bold text-brand-600 mt-1">
                {result.coherenceScore.toFixed(3)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Inter-topic word co-occurrence</div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cloud AI Titles</div>
              <button
                onClick={handleGenerateAiTitles}
                disabled={aiNaming}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 disabled:opacity-50 transition-colors mt-2 cursor-pointer"
              >
                {aiNaming ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Naming...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Generate AI Topic Names</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Visualizations: 2D PCA Scatter Plot & Topic Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PCA 2D Scatter Plot (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-brand-600" />
                  <h4 className="text-sm font-bold text-slate-800">
                    2D PCA Projection of Document Chunks
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400">Hover point to inspect</span>
              </div>

              {/* SVG 2D Scatter View */}
              <div className="relative w-full h-80 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                <svg className="w-full h-full p-6" viewBox="-120 -120 240 240">
                  {/* Grid Lines */}
                  <line x1="-100" y1="0" x2="100" y2="0" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,2" />
                  <line x1="0" y1="-100" x2="0" y2="100" stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="2,2" />
                  <text x="85" y="-4" fill="#94a3b8" fontSize="6" fontFamily="sans-serif">PC1</text>
                  <text x="4" y="-85" fill="#94a3b8" fontSize="6" fontFamily="sans-serif">PC2</text>

                  {/* Points */}
                  {result.points.map((pt) => {
                    const color = CLUSTER_COLORS[pt.cluster % CLUSTER_COLORS.length];
                    const isHovered = hoveredPoint?.id === pt.id;
                    return (
                      <circle
                        key={pt.id}
                        cx={pt.x * 90}
                        cy={-pt.y * 90}
                        r={isHovered ? 6 : 3.5}
                        fill={color.hex}
                        fillOpacity={isHovered ? 1 : 0.75}
                        stroke={isHovered ? '#0f172a' : '#ffffff'}
                        strokeWidth={isHovered ? 1.5 : 0.5}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() =>
                          setHoveredPoint({
                            id: pt.id,
                            documentName: pt.documentName,
                            textSnippet: pt.textSnippet,
                            cluster: pt.cluster,
                            x: pt.x,
                            y: pt.y,
                          })
                        }
                      />
                    );
                  })}
                </svg>

                {/* Point Hover Tooltip Overlay */}
                {hoveredPoint && (
                  <div className="absolute bottom-2 left-2 right-2 p-2.5 rounded-lg bg-slate-900/90 text-white text-[11px] backdrop-blur-xs shadow-lg pointer-events-none transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-brand-300">
                        Topic {hoveredPoint.cluster + 1} · {hoveredPoint.documentName}
                      </span>
                      <span className="font-mono text-slate-400">
                        ({hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)})
                      </span>
                    </div>
                    <p className="line-clamp-2 text-slate-200 italic">
                      "{hoveredPoint.textSnippet}"
                    </p>
                  </div>
                )}
              </div>

              {/* Cluster Color Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                {result.topics.map((t, idx) => {
                  const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
                  return (
                    <div key={t.topicId} className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded-full ${color.bg}`} />
                      <span className="font-medium text-slate-700">
                        {t.title || `Topic ${t.topicId}`} ({t.chunkCount})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Topic Cards & c-TF-IDF Keywords (5 Cols) */}
            <div className="lg:col-span-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-600" />
                <span>Extracted Topics & c-TF-IDF Terms</span>
              </h4>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {result.topics.map((topic, idx) => {
                  const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
                  return (
                    <div
                      key={topic.topicId}
                      className={`p-4 rounded-xl border ${color.border} ${color.light} transition-shadow hover:shadow-xs`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-bold ${color.text}`}>
                          {topic.title || `Topic ${topic.topicId}`}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {topic.chunkCount} chunks (coherence: {topic.coherenceScore.toFixed(2)})
                        </span>
                      </div>

                      {/* Keywords */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {topic.keywords.map((kw) => (
                          <span
                            key={kw.word}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 shadow-3xs"
                          >
                            <span>{kw.word}</span>
                            <span className="text-[9px] font-mono text-slate-400">
                              {kw.score.toFixed(2)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Document-Topic Distribution Breakdown */}
          {result.documentDistributions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-brand-600" />
                <span>Document-to-Topic Proportion Breakdown</span>
              </h4>

              <div className="space-y-3">
                {result.documentDistributions.map((docShare) => (
                  <div key={docShare.documentId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="truncate max-w-md">{docShare.documentName}</span>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden">
                      {result.topics.map((t, idx) => {
                        const pct = docShare.topicDistribution[t.topicId] || 0;
                        if (pct <= 0) return null;
                        const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
                        return (
                          <div
                            key={t.topicId}
                            className={`${color.bg} transition-all`}
                            style={{ width: `${pct}%` }}
                            title={`${t.title || `Topic ${t.topicId}`}: ${pct}%`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
