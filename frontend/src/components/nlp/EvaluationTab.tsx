import React, { useState, useEffect } from 'react';
import {
  Award,
  Play,
  RefreshCw,
  Clock,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import {
  NlpService,
  NlpEvaluationReport,
  LLMQuotaStatus,
  ConfusionMatrixCell,
  SentimentLabel,
} from '../../services/nlpService.js';

export const EvaluationTab: React.FC = () => {
  const [report, setReport] = useState<NlpEvaluationReport | null>(null);
  const [quota, setQuota] = useState<LLMQuotaStatus | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load cached report (if already run) and quota on mount; NEVER run benchmark on page load
  useEffect(() => {
    loadCachedReport();
    loadQuota();
  }, []);

  const loadCachedReport = async () => {
    try {
      const cached = await NlpService.getEvaluationReport();
      if (cached) setReport(cached);
    } catch (err: any) {
      console.warn('Could not load cached evaluation report:', err);
    }
  };

  const loadQuota = async () => {
    try {
      const q = await NlpService.getLlmQuota();
      setQuota(q);
    } catch (err: any) {
      console.warn('Could not load LLM quota:', err);
    }
  };

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const newReport = await NlpService.runEvaluation(true);
      setReport(newReport);
      await loadQuota();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Evaluation run failed.');
    } finally {
      setIsRunning(false);
    }
  };

  // Helper to extract count from confusion matrix
  const getMatrixCount = (matrix: ConfusionMatrixCell[], gold: SentimentLabel, pred: SentimentLabel) => {
    const found = matrix.find((c) => c.gold === gold && c.predicted === pred);
    return found ? found.count : 0;
  };

  // Color intensity for confusion matrix cells
  const getMatrixCellClass = (count: number, isDiagonal: boolean) => {
    if (isDiagonal) {
      if (count >= 12) return 'bg-emerald-600 text-white font-bold';
      if (count >= 7) return 'bg-emerald-400 text-white font-bold';
      if (count >= 1) return 'bg-emerald-100 text-emerald-900 font-semibold';
      return 'bg-slate-50 text-slate-400';
    } else {
      if (count >= 5) return 'bg-rose-200 text-rose-950 font-bold';
      if (count >= 1) return 'bg-rose-50 text-rose-800 font-medium';
      return 'bg-slate-50 text-slate-400';
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner: Benchmark Controls & Gemini Quota Telemetry */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">
              CO2 Empirical Evaluation Benchmark
            </h3>
            {report && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Cached Results Available
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Evaluates accuracy, macro precision/recall/F1, and confusion matrices against curated gold standard datasets.
          </p>
        </div>

        {/* Quota Telemetry & Run Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {quota && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-3">
              <Gauge className="w-4 h-4 text-brand-600 shrink-0" />
              <div>
                <div className="flex items-center gap-2 font-bold text-slate-800 text-[11px]">
                  <span>Daily Quota:</span>
                  <span className="font-mono text-brand-600">
                    {quota.dailyUsage} / {quota.dailyLimit} calls
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Throttle: {quota.rpmUsage}/{quota.maxRpm} RPM | Resets at midnight UTC
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Evaluating Batches...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Run Evaluation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* When evaluation hasn't been run yet */}
      {!report && !isRunning && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-12 text-center space-y-4">
          <Award className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-base font-bold text-slate-800">Gold Standard Benchmark Not Yet Executed</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Click <strong>"Run Evaluation"</strong> above to benchmark Lexicon (AFINN) vs Gemini on 52 gold sentences, and Rule-Based vs Gemini on 21 annotated NER passages.
          </p>
        </div>
      )}

      {/* Report Results */}
      {report && (
        <div className="space-y-8">
          {/* 1. SENTIMENT CLASSIFICATION BENCHMARK */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Sentiment Classification Benchmark ({report.sentiment.datasetSize} Gold Sentences)</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Direct comparison of Rule-Based Lexicon (AFINN-165) vs Transformer LLM (Gemini).
                </p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Evaluated: {new Date(report.evaluatedAt).toLocaleTimeString()}
              </span>
            </div>

            {/* Metric Comparison Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lexicon Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Lexicon Method (AFINN-165)
                  </h5>
                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {report.sentiment.lexicon.latencyMs}ms
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Accuracy</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {report.sentiment.lexicon.accuracy}%
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Precision</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {report.sentiment.lexicon.macroPrecision}%
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Recall</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {report.sentiment.lexicon.macroRecall}%
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Macro F1</span>
                    <span className="text-base font-bold text-brand-600 font-mono">
                      {report.sentiment.lexicon.macroF1}%
                    </span>
                  </div>
                </div>

                {/* Lexicon Confusion Matrix Custom Grid */}
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-2">
                    Lexicon 3×3 Confusion Matrix:
                  </span>
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-400 font-medium">
                        <th className="p-1.5 text-left text-[10px]">Gold \ Pred</th>
                        <th className="p-1.5 text-[10px]">Pred Pos</th>
                        <th className="p-1.5 text-[10px]">Pred Neu</th>
                        <th className="p-1.5 text-[10px]">Pred Neg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['positive', 'neutral', 'negative'] as const).map((goldLabel) => (
                        <tr key={goldLabel}>
                          <td className="p-1.5 text-left font-bold text-slate-700 capitalize text-[10px]">
                            {goldLabel}
                          </td>
                          {(['positive', 'neutral', 'negative'] as const).map((predLabel) => {
                            const count = getMatrixCount(
                              report.sentiment.lexicon.confusionMatrix,
                              goldLabel,
                              predLabel
                            );
                            const isDiagonal = goldLabel === predLabel;
                            return (
                              <td
                                key={predLabel}
                                className={`p-2 border border-slate-200 rounded font-mono ${getMatrixCellClass(
                                  count,
                                  isDiagonal
                                )}`}
                              >
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gemini Card */}
              <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    Transformer LLM (Gemini Structured)
                  </h5>
                  <span className="text-[11px] font-mono text-brand-700 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {report.sentiment.gemini.latencyMs}ms
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white p-2.5 rounded-lg border border-brand-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Accuracy</span>
                    <span className="text-base font-bold text-emerald-700 font-mono">
                      {report.sentiment.gemini.accuracy}%
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-brand-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Precision</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {report.sentiment.gemini.macroPrecision}%
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-brand-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Recall</span>
                    <span className="text-base font-bold text-slate-900 font-mono">
                      {report.sentiment.gemini.macroRecall}%
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-brand-200">
                    <span className="text-[10px] text-slate-500 font-bold block">Macro F1</span>
                    <span className="text-base font-bold text-brand-600 font-mono">
                      {report.sentiment.gemini.macroF1}%
                    </span>
                  </div>
                </div>

                {/* Gemini Confusion Matrix Custom Grid */}
                <div>
                  <span className="text-[11px] font-bold text-brand-900 block mb-2">
                    Gemini 3×3 Confusion Matrix:
                  </span>
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-400 font-medium">
                        <th className="p-1.5 text-left text-[10px]">Gold \ Pred</th>
                        <th className="p-1.5 text-[10px]">Pred Pos</th>
                        <th className="p-1.5 text-[10px]">Pred Neu</th>
                        <th className="p-1.5 text-[10px]">Pred Neg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['positive', 'neutral', 'negative'] as const).map((goldLabel) => (
                        <tr key={goldLabel}>
                          <td className="p-1.5 text-left font-bold text-slate-700 capitalize text-[10px]">
                            {goldLabel}
                          </td>
                          {(['positive', 'neutral', 'negative'] as const).map((predLabel) => {
                            const count = getMatrixCount(
                              report.sentiment.gemini.confusionMatrix,
                              goldLabel,
                              predLabel
                            );
                            const isDiagonal = goldLabel === predLabel;
                            return (
                              <td
                                key={predLabel}
                                className={`p-2 border border-brand-200 rounded font-mono ${getMatrixCellClass(
                                  count,
                                  isDiagonal
                                )}`}
                              >
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* 2. NER EVALUATION (RULE-BASED vs GEMINI) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Named Entity Recognition Benchmark ({report.entities.datasetSize} Gold Passages)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact span vs partial overlap precision, recall, and F1 across 7 entity types.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Rule-Based NER Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Rule-Based Pattern Matcher
                  </h5>
                  <span className="text-[11px] font-mono text-slate-500">
                    Latency: {report.entities.ruleBased.latencyMs}ms
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Exact Span Match:
                    </span>
                    <div className="flex justify-between text-xs font-mono">
                      <span>P: {report.entities.ruleBased.exactMatch.precision}%</span>
                      <span>R: {report.entities.ruleBased.exactMatch.recall}%</span>
                      <span className="font-bold text-brand-600">
                        F1: {report.entities.ruleBased.exactMatch.f1}%
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Partial Overlap Match:
                    </span>
                    <div className="flex justify-between text-xs font-mono">
                      <span>P: {report.entities.ruleBased.partialMatch.precision}%</span>
                      <span>R: {report.entities.ruleBased.partialMatch.recall}%</span>
                      <span className="font-bold text-emerald-700">
                        F1: {report.entities.ruleBased.partialMatch.f1}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gemini NER Card */}
              <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    Gemini Zero-Shot Entity Extraction
                  </h5>
                  <span className="text-[11px] font-mono text-brand-700">
                    Latency: {report.entities.gemini.latencyMs}ms
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-white rounded-lg border border-brand-200">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Exact Span Match:
                    </span>
                    <div className="flex justify-between text-xs font-mono">
                      <span>P: {report.entities.gemini.exactMatch.precision}%</span>
                      <span>R: {report.entities.gemini.exactMatch.recall}%</span>
                      <span className="font-bold text-brand-600">
                        F1: {report.entities.gemini.exactMatch.f1}%
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-brand-200">
                    <span className="text-[11px] font-bold text-slate-700 block mb-1">
                      Partial Overlap Match:
                    </span>
                    <div className="flex justify-between text-xs font-mono">
                      <span>P: {report.entities.gemini.partialMatch.precision}%</span>
                      <span>R: {report.entities.gemini.partialMatch.recall}%</span>
                      <span className="font-bold text-emerald-700">
                        F1: {report.entities.gemini.partialMatch.f1}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. STEP-BY-STEP REVIEW GUIDE FOR MENTORS / EVALUATORS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-600" />
              How to Review & Correct Gold Dataset Annotations (Course Rubric)
            </h4>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p>
                <strong>1. Sentiment Dataset:</strong> Located at{' '}
                <code className="text-brand-700 font-bold">backend/eval/sentiment_gold.json</code>. Contains 52 balanced scientific sentences. To review or adjust labels, verify whether the sentence conveys a breakthrough (positive), limitation (negative), or factual setup (neutral).
              </p>
              <p>
                <strong>2. Entity Dataset:</strong> Located at{' '}
                <code className="text-brand-700 font-bold">backend/eval/entities_gold.json</code>. Contains 21 passages annotated with ground truth entities across 7 categories (`PERSON`, `ORG`, `DATASET`, `METRIC`, `MODEL`, `DATE`, `LOCATION`).
              </p>
              <p>
                <strong>3. Strict Separation:</strong> None of the extraction or classification services are tuned to or train on these gold datasets. Evaluation computes unbiased empirical metrics.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
