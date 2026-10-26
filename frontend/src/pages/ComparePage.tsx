import React, { useState } from 'react';
import { GitCompare, Sparkles, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.js';
import { researchService } from '../services/researchService.js';
import { ComparisonResult } from '../types/research.js';
import { ComparisonTable } from '../components/research/ComparisonTable.js';
import { Button } from '../components/common/Button.js';
import { LoadingState } from '../components/common/LoadingState.js';
import { ErrorMessage } from '../components/common/ErrorMessage.js';
import { EmptyState } from '../components/common/EmptyState.js';

export const ComparePage: React.FC = () => {
  const { documents, selectedDocIds, toggleSelectDoc, selectAllDocs, clearSelectedDocs } =
    useWorkspace();

  const [focusTopic, setFocusTopic] = useState('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const selectedReadyDocs = readyDocs.filter((d) => selectedDocIds.includes(d._id));
  const canCompare = selectedReadyDocs.length >= 2;

  const handleRunComparison = async () => {
    if (!canCompare) return;

    try {
      setLoading(true);
      setError(null);

      const result = await researchService.compareDocuments({
        documentIds: selectedReadyDocs.map((d) => d._id),
        focusTopic: focusTopic.trim() || undefined,
      });

      setComparisonResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to generate cross-document comparison.');
    } finally {
      setLoading(false);
    }
  };

  const allReadySelected =
    readyDocs.length > 0 && readyDocs.every((d) => selectedDocIds.includes(d._id));

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
        <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
          Cross-Paper Comparative Analysis
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Compare Research Papers
        </h1>
        <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
          Select at least two indexed papers to synthesize side-by-side matrices across 8 academic
          dimensions: Research Objective, Methodology, Model/Architecture, Dataset, Metrics, Results,
          Limitations, and Conclusions.
        </p>
      </div>

      {/* Multi-Document Selector Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Select Papers to Compare ({selectedReadyDocs.length} of {readyDocs.length} selected)
            </h3>
          </div>

          <button
            onClick={allReadySelected ? clearSelectedDocs : () => selectAllDocs()}
            className="text-xs text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center gap-1 transition-colors"
          >
            {allReadySelected ? (
              <>
                <CheckSquare className="w-3.5 h-3.5" /> Deselect All
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5" /> Select All ({readyDocs.length})
              </>
            )}
          </button>
        </div>

        {readyDocs.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
            No ready documents available. Upload at least 2 PDFs in the Documents page first.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {readyDocs.map((doc) => {
              const isSelected = selectedDocIds.includes(doc._id);
              return (
                <div
                  key={doc._id}
                  onClick={() => toggleSelectDoc(doc._id)}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-2.5 text-xs select-none ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/60 shadow-2xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="w-4 h-4 mt-0.5 rounded text-brand-600 focus:ring-brand-500 border-slate-300 pointer-events-none"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 truncate" title={doc.originalName}>
                      {doc.originalName}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {doc.pageCount} pages • {doc.chunkCount} passages
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Optional Focus Topic & Submit */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Optional focus topic (e.g., Attention mechanisms, Pretraining dataset, or Evaluation metrics)..."
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
            />
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={!canCompare || loading}
            isLoading={loading}
            onClick={handleRunComparison}
            icon={<Sparkles className="w-4 h-4" />}
          >
            {loading ? 'Synthesizing...' : `Compare ${selectedReadyDocs.length} Papers`}
          </Button>
        </div>

        {!canCompare && readyDocs.length >= 2 && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            Please select at least 2 papers above to enable comparative matrix generation.
          </p>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-2xs text-center">
          <LoadingState message="Extracting comparative evidence across 8 dimensions..." size="lg" />
          <p className="text-xs text-slate-400 mt-2">
            Grounding claims in paper citations and evaluating similarities & differences...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && <ErrorMessage message={error} onRetry={handleRunComparison} />}

      {/* Degraded state notice */}
      {comparisonResult?.degraded && !loading && (
        <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold">Comparative Synthesis Degraded Mode</h4>
            <p className="text-xs text-orange-700 mt-1 leading-relaxed">
              {comparisonResult.degradedReason || 'LLM comparative synthesis was unavailable. Documents and retrieved citations remain indexed.'}
            </p>
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {comparisonResult && !loading && <ComparisonTable comparison={comparisonResult} />}

      {/* Empty State before comparison runs */}
      {!comparisonResult && !loading && (
        <EmptyState
          icon={GitCompare}
          title="Ready for Comparative Analysis"
          description="Select 2 or more research papers and click 'Compare Papers' to dynamically generate an academic comparison matrix."
        />
      )}
    </div>
  );
};
