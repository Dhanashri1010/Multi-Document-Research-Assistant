import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BarChart3,
  Layers,
  ArrowRight,
  CheckSquare,
  Square,
  RefreshCw,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { IDocument } from '../../types/document.js';
import {
  NlpService,
  PreprocessingResult,
  PreprocessingPipelineSteps,
  VectorizationResponse,
} from '../../services/nlpService.js';

interface PreprocessingTabProps {
  documents: IDocument[];
  selectedDoc: IDocument | null;
  onSelectDoc: (doc: IDocument) => void;
}

export const PreprocessingTab: React.FC<PreprocessingTabProps> = ({
  documents,
  selectedDoc,
  onSelectDoc,
}) => {
  const [steps, setSteps] = useState<Required<PreprocessingPipelineSteps>>({
    unicodeNormalization: true,
    lowercase: true,
    noiseRemoval: true,
    headerFooterRemoval: true,
    hyphenationRepair: true,
    tokenization: true,
    stopwordRemoval: true,
    stemming: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepResult, setPrepResult] = useState<PreprocessingResult | null>(null);

  // Vectorization & Heatmap state
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [vectorResult, setVectorResult] = useState<VectorizationResponse | null>(null);
  const [heatmapMode, setHeatmapMode] = useState<'tfidf' | 'dense'>('tfidf');

  const readyDocs = documents.filter((d) => d.status === 'ready');

  // Trigger preprocessing when selected document changes
  useEffect(() => {
    if (selectedDoc) {
      handleRunPreprocessing();
    }
  }, [selectedDoc?._id]);

  // Trigger vectorization across ready documents
  useEffect(() => {
    if (readyDocs.length > 0) {
      handleRunVectorization();
    }
  }, [readyDocs.length]);

  const handleRunPreprocessing = async () => {
    if (!selectedDoc) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await NlpService.preprocessText({
        documentId: selectedDoc._id,
        steps,
        useCache: true,
      });
      setPrepResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Preprocessing failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunVectorization = async () => {
    if (readyDocs.length === 0) return;
    setIsVectorizing(true);
    try {
      const docIds = readyDocs.slice(0, 6).map((d) => d._id);
      const data = await NlpService.vectorizeDocuments(docIds);
      setVectorResult(data);
    } catch (err: any) {
      console.warn('Vectorization failed:', err);
    } finally {
      setIsVectorizing(false);
    }
  };

  const toggleStep = (key: keyof PreprocessingPipelineSteps) => {
    setSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Prepare top terms for chart
  const chartData = prepResult?.topTerms.slice(0, 15).map((t) => ({
    term: t.term,
    count: t.count,
  })) || [];

  // Unique document IDs for the heatmap grid
  const matrixDocIds = Array.from(new Set(vectorResult?.matrix.map((c) => c.docAId) || []));
  const matrixDocTitles = new Map<string, string>();
  vectorResult?.matrix.forEach((c) => {
    matrixDocTitles.set(c.docAId, c.docATitle);
  });

  const getHeatmapColor = (val: number) => {
    if (val >= 0.8) return 'bg-brand-600 text-white font-bold';
    if (val >= 0.6) return 'bg-brand-500 text-white font-semibold';
    if (val >= 0.4) return 'bg-brand-300 text-slate-900';
    if (val >= 0.2) return 'bg-brand-100 text-slate-800';
    if (val > 0.05) return 'bg-slate-100 text-slate-700';
    return 'bg-slate-50 text-slate-400';
  };

  return (
    <div className="space-y-8">
      {/* Top Controls: Document Picker & Pipeline Toggles */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-600" />
              CO1: Text Preprocessing & Cleaning Pipeline
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Select pipeline cleaning operations to execute on unstructured research text.
            </p>
          </div>

          {/* Document Dropdown */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Document:</label>
            <select
              value={selectedDoc?._id || ''}
              onChange={(e) => {
                const found = documents.find((d) => d._id === e.target.value);
                if (found) onSelectDoc(found);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 shadow-2xs focus:ring-2 focus:ring-brand-500 max-w-xs truncate"
            >
              {documents.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.title || d.originalName} ({d.pageCount ? `${d.pageCount} pgs` : d.fileType})
                </option>
              ))}
            </select>
            <button
              onClick={handleRunPreprocessing}
              disabled={isLoading || !selectedDoc}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Apply Pipeline</span>
            </button>
          </div>
        </div>

        {/* Step Checkbox Controls */}
        <div>
          <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
            Pipeline Steps (Click to Toggle):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'unicodeNormalization', label: 'Unicode NFKC' },
              { key: 'lowercase', label: 'Lowercase' },
              { key: 'noiseRemoval', label: 'URL & Noise Strip' },
              { key: 'headerFooterRemoval', label: 'Header / Footer' },
              { key: 'hyphenationRepair', label: 'De-hyphenation' },
              { key: 'tokenization', label: 'Tokenization' },
              { key: 'stopwordRemoval', label: 'Stopwords (50+)' },
              { key: 'stemming', label: 'Porter Stemming' },
            ].map(({ key, label }) => {
              const active = steps[key as keyof PreprocessingPipelineSteps];
              return (
                <button
                  key={key}
                  onClick={() => toggleStep(key as keyof PreprocessingPipelineSteps)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left ${
                    active
                      ? 'border-brand-500 bg-brand-50/70 text-brand-900 shadow-2xs'
                      : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {active ? (
                    <CheckSquare className="w-4 h-4 text-brand-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards: Raw vs Cleaned */}
      {prepResult && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Raw Characters</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{prepResult.rawStats.charCount.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400">Before cleaning</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Cleaned Chars</span>
            <span className="text-xl font-bold text-brand-600 mt-1 block">{prepResult.cleanedStats.charCount.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">{prepResult.reductionRatioPercent}% reduction</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Raw Words</span>
            <span className="text-xl font-bold text-slate-900 mt-1 block">{prepResult.rawStats.wordCount.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400">{prepResult.rawStats.sentenceCount} sentences</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Cleaned Tokens</span>
            <span className="text-xl font-bold text-brand-600 mt-1 block">{prepResult.cleanedStats.tokenCount.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 font-medium">Post-stopword token count</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Vocabulary Size</span>
            <span className="text-xl font-bold text-purple-700 mt-1 block">{prepResult.cleanedStats.vocabSize.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400">Unique stemmed terms</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Stopwords Removed</span>
            <span className="text-xl font-bold text-amber-600 mt-1 block">{prepResult.stopwordsRemovedCount.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500">Filtered noise words</span>
          </div>
        </div>
      )}

      {/* Side-by-Side Before/After Text Viewer */}
      {prepResult && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-600" />
              Before & After Text Comparison
            </span>
            <span className="text-xs text-slate-400 font-normal">Showing first 5,000 characters excerpt</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Raw Unstructured Text</span>
                <span className="text-[11px] text-slate-500 font-mono">{prepResult.rawStats.charCount} chars</span>
              </div>
              <div className="h-64 overflow-y-auto font-mono text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200">
                {prepResult.rawText}
              </div>
            </div>

            <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-900 uppercase tracking-wider">Cleaned & Stemmed Tokens</span>
                <span className="text-[11px] text-brand-700 font-mono">{prepResult.cleanedStats.charCount} chars</span>
              </div>
              <div className="h-64 overflow-y-auto font-mono text-xs text-brand-950 leading-relaxed whitespace-pre-wrap bg-white p-3 rounded-lg border border-brand-200">
                {prepResult.cleanedText}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vectorization: TF-IDF Chart & Similarity Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top-15 TF-IDF Terms Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-600" />
              Top TF-IDF Terms ({selectedDoc?.title || selectedDoc?.originalName || 'Selected Document'})
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Term Frequency × Inverse Document Frequency score highlighting salient keywords.
            </p>
          </div>

          <div className="h-72 mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis type="category" dataKey="term" tick={{ fontSize: 11, fill: '#334155' }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Select a document to compute TF-IDF terms
              </div>
            )}
          </div>
        </div>

        {/* Pairwise Document Similarity Custom Heatmap Grid */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                Cross-Document Cosine Similarity Heatmap
              </h4>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-semibold">
                <button
                  onClick={() => setHeatmapMode('tfidf')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    heatmapMode === 'tfidf' ? 'bg-white text-brand-700 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  TF-IDF
                </button>
                <button
                  onClick={() => setHeatmapMode('dense')}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    heatmapMode === 'dense' ? 'bg-white text-brand-700 shadow-2xs font-bold' : 'text-slate-600'
                  }`}
                >
                  Dense Embeddings
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Custom similarity grid comparing classical lexical TF-IDF vs dense embeddings.
            </p>
          </div>

          {/* Custom Heatmap Grid */}
          <div className="mt-4 overflow-x-auto">
            {matrixDocIds.length > 0 ? (
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left text-slate-400 font-medium"></th>
                    {matrixDocIds.map((id, idx) => (
                      <th
                        key={id}
                        className="p-2 text-slate-700 font-bold max-w-[90px] truncate"
                        title={matrixDocTitles.get(id)}
                      >
                        Doc {idx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixDocIds.map((rowId, rowIdx) => (
                    <tr key={rowId}>
                      <td
                        className="p-2 text-left font-bold text-slate-700 max-w-[100px] truncate"
                        title={matrixDocTitles.get(rowId)}
                      >
                        Doc {rowIdx + 1}
                      </td>
                      {matrixDocIds.map((colId) => {
                        const cell = vectorResult?.matrix.find(
                          (c) => c.docAId === rowId && c.docBId === colId
                        );
                        const val =
                          heatmapMode === 'tfidf'
                            ? cell?.tfidfSimilarity ?? 0
                            : cell?.denseSimilarity ?? 0;

                        return (
                          <td
                            key={colId}
                            className={`p-2.5 border border-slate-100 font-mono transition-colors ${getHeatmapColor(
                              val
                            )}`}
                            title={`${matrixDocTitles.get(rowId)} vs ${matrixDocTitles.get(colId)}: ${(val * 100).toFixed(1)}%`}
                          >
                            {(val * 100).toFixed(0)}%
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-48 flex items-center justify-center text-xs text-slate-400">
                Upload and index at least 2 documents to render cross-document similarity heatmap.
              </div>
            )}
          </div>

          {vectorResult?.comparisonInsight && (
            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 mt-4 leading-relaxed">
              <strong>Observation:</strong> {vectorResult.comparisonInsight}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
