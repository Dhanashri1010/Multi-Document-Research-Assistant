import React, { useState, useEffect } from 'react';
import {
  Smile,
  Frown,
  Meh,
  Tag,
  Key,
  FileCheck,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  Filter,
} from 'lucide-react';
import { IDocument } from '../../types/document.js';
import {
  NlpService,
  SentimentAnalysisResponse,
  ExtractionResponse,
  EntityType,
} from '../../services/nlpService.js';

interface SentimentExtractionTabProps {
  documents: IDocument[];
  selectedDoc: IDocument | null;
  onSelectDoc: (doc: IDocument) => void;
}

export const SentimentExtractionTab: React.FC<SentimentExtractionTabProps> = ({
  documents,
  selectedDoc,
  onSelectDoc,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'sentiment' | 'extraction'>('sentiment');
  const [runGemini, setRunGemini] = useState<boolean>(true);

  // Sentiment State
  const [sentimentResult, setSentimentResult] = useState<SentimentAnalysisResponse | null>(null);
  const [isSentimentLoading, setIsSentimentLoading] = useState(false);
  const [sentimentError, setSentimentError] = useState<string | null>(null);

  // Extraction State
  const [extractionResult, setExtractionResult] = useState<ExtractionResponse | null>(null);
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<EntityType | 'ALL'>('ALL');
  const [copiedJson, setCopiedJson] = useState(false);

  useEffect(() => {
    if (selectedDoc) {
      if (activeSubTab === 'sentiment') {
        loadSentiment();
      } else {
        loadExtraction();
      }
    }
  }, [selectedDoc?._id, activeSubTab]);

  const loadSentiment = async () => {
    if (!selectedDoc) return;
    setIsSentimentLoading(true);
    setSentimentError(null);
    try {
      const data = await NlpService.analyzeSentiment(selectedDoc._id, {
        runGemini,
        sampleSize: 35,
        useCache: true,
      });
      setSentimentResult(data);
    } catch (err: any) {
      setSentimentError(err?.response?.data?.error || err.message || 'Sentiment analysis failed.');
    } finally {
      setIsSentimentLoading(false);
    }
  };

  const loadExtraction = async () => {
    if (!selectedDoc) return;
    setIsExtractionLoading(true);
    setExtractionError(null);
    try {
      const data = await NlpService.extractInformation(selectedDoc._id, {
        runGemini,
        useCache: true,
      });
      setExtractionResult(data);
    } catch (err: any) {
      setExtractionError(err?.response?.data?.error || err.message || 'Information extraction failed.');
    } finally {
      setIsExtractionLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!extractionResult?.structuredData) return;
    navigator.clipboard.writeText(JSON.stringify(extractionResult.structuredData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const filteredEntities =
    extractionResult?.entities.filter((e) =>
      selectedEntityType === 'ALL' ? true : e.type === selectedEntityType
    ) || [];

  return (
    <div className="space-y-6">
      {/* Document Picker & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">
            CO2: Sentiment Analysis & Information Extraction
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare lexicon (AFINN/VADER) vs LLM structured extraction across your documents.
          </p>
        </div>

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
                {d.title || d.originalName}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={runGemini}
              onChange={(e) => setRunGemini(e.target.checked)}
              className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Include Gemini</span>
          </label>

          <button
            onClick={activeSubTab === 'sentiment' ? loadSentiment : loadExtraction}
            disabled={isSentimentLoading || isExtractionLoading || !selectedDoc}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSentimentLoading || isExtractionLoading ? 'animate-spin' : ''}`}
            />
            <span>Analyze</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs: Sentiment vs Extraction */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setActiveSubTab('sentiment')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'sentiment'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Smile className="w-4 h-4" />
          <span>Sentiment Analysis (Lexicon vs Gemini)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('extraction')}
          className={`pb-3 text-xs font-bold transition-colors border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'extraction'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Information Extraction & NER</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. SENTIMENT ANALYSIS VIEW                                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'sentiment' && (
        <div className="space-y-6">
          {sentimentError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{sentimentError}</span>
            </div>
          )}

          {sentimentResult && (
            <>
              {/* Dual-Method Comparison Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Method A: Lexicon (AFINN) */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Method A</span>
                      <h4 className="text-sm font-bold text-slate-900">Rule-Based Lexicon (AFINN-165)</h4>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        sentimentResult.lexiconStats.overallLabel === 'positive'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : sentimentResult.lexiconStats.overallLabel === 'negative'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {sentimentResult.lexiconStats.overallLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Positive</span>
                      <span className="text-lg font-bold text-emerald-900">{sentimentResult.lexiconStats.positivePct}%</span>
                      <span className="text-[10px] text-emerald-600">{sentimentResult.lexiconStats.positiveCount} sents</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-600 uppercase block">Neutral</span>
                      <span className="text-lg font-bold text-slate-800">{sentimentResult.lexiconStats.neutralPct}%</span>
                      <span className="text-[10px] text-slate-500">{sentimentResult.lexiconStats.neutralCount} sents</span>
                    </div>
                    <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                      <span className="text-[10px] font-bold text-rose-700 uppercase block">Negative</span>
                      <span className="text-lg font-bold text-rose-900">{sentimentResult.lexiconStats.negativePct}%</span>
                      <span className="text-[10px] text-rose-600">{sentimentResult.lexiconStats.negativeCount} sents</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                    <strong>Algorithmic Rationale:</strong> Deterministic word valence lookup on tokenized terms normalized between -1.0 and +1.0. Fast, lightweight local execution (zero API quota consumption).
                  </p>
                </div>

                {/* Method B: Gemini Structured JSON */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[11px] font-bold text-brand-600 uppercase tracking-wider block">Method B</span>
                      <h4 className="text-sm font-bold text-slate-900">Transformer LLM (Gemini Structured JSON)</h4>
                    </div>
                    {sentimentResult.geminiStats ? (
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                          sentimentResult.geminiStats.overallLabel === 'positive'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : sentimentResult.geminiStats.overallLabel === 'negative'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {sentimentResult.geminiStats.overallLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not evaluated</span>
                    )}
                  </div>

                  {sentimentResult.geminiStats ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                          <span className="text-[10px] font-bold text-emerald-700 uppercase block">Positive</span>
                          <span className="text-lg font-bold text-emerald-900">{sentimentResult.geminiStats.positivePct}%</span>
                          <span className="text-[10px] text-emerald-600">{sentimentResult.geminiStats.positiveCount} sents</span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-600 uppercase block">Neutral</span>
                          <span className="text-lg font-bold text-slate-800">{sentimentResult.geminiStats.neutralPct}%</span>
                          <span className="text-[10px] text-slate-500">{sentimentResult.geminiStats.neutralCount} sents</span>
                        </div>
                        <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100">
                          <span className="text-[10px] font-bold text-rose-700 uppercase block">Negative</span>
                          <span className="text-lg font-bold text-rose-900">{sentimentResult.geminiStats.negativePct}%</span>
                          <span className="text-[10px] text-rose-600">{sentimentResult.geminiStats.negativeCount} sents</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-brand-50/50 p-3 rounded-xl border border-brand-100">
                        <span className="font-semibold text-brand-900">Inter-Method Agreement Rate:</span>
                        <span className="font-bold text-brand-700 text-sm font-mono">
                          {sentimentResult.agreementRatePct}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Enable "Include Gemini" to run LLM structured batch classification.
                    </div>
                  )}
                </div>
              </div>

              {/* Most Positive & Most Negative Sentences with Page Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Most Positive */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-3">
                  <h4 className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                    <Smile className="w-4 h-4 text-emerald-600" />
                    Top Positive Sentences (Grounded Evidence)
                  </h4>
                  <div className="space-y-3">
                    {sentimentResult.mostPositive.map((sent, idx) => (
                      <div key={idx} className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-emerald-800 font-semibold">
                          <span>{sent.pageNumber ? `Page ${sent.pageNumber}` : 'Document Excerpt'}</span>
                          <span className="font-mono">AFINN: +{sent.lexicon.score}</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed italic">"{sent.text}"</p>
                        {sent.gemini?.rationale && (
                          <p className="text-[11px] text-slate-500">Gemini: {sent.gemini.rationale}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Most Negative */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-3">
                  <h4 className="text-sm font-bold text-rose-800 flex items-center gap-2">
                    <Frown className="w-4 h-4 text-rose-600" />
                    Top Negative / Limitation Sentences
                  </h4>
                  <div className="space-y-3">
                    {sentimentResult.mostNegative.map((sent, idx) => (
                      <div key={idx} className="p-3 bg-rose-50/40 rounded-xl border border-rose-100 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-rose-800 font-semibold">
                          <span>{sent.pageNumber ? `Page ${sent.pageNumber}` : 'Document Excerpt'}</span>
                          <span className="font-mono">AFINN: {sent.lexicon.score}</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed italic">"{sent.text}"</p>
                        {sent.gemini?.rationale && (
                          <p className="text-[11px] text-slate-500">Gemini: {sent.gemini.rationale}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. INFORMATION EXTRACTION VIEW                                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'extraction' && (
        <div className="space-y-6">
          {extractionError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{extractionError}</span>
            </div>
          )}

          {extractionResult && (
            <>
              {/* NER Entity Filter Pills & Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-brand-600" />
                      Named Entity Recognition (NER) Across 7 Types
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Extracted via rule-based patterns and LLM structured extraction.
                    </p>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['ALL', 'MODEL', 'DATASET', 'METRIC', 'ORG', 'PERSON', 'DATE'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedEntityType(type)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer transition-colors ${
                          selectedEntityType === type
                            ? 'bg-brand-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-4">Entity Text</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Source</th>
                        <th className="py-2.5 px-4 text-right">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEntities.map((e, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-semibold text-slate-900">{e.text}</td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                e.type === 'MODEL'
                                  ? 'bg-purple-100 text-purple-800'
                                  : e.type === 'DATASET'
                                  ? 'bg-blue-100 text-blue-800'
                                  : e.type === 'METRIC'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : e.type === 'ORG'
                                  ? 'bg-amber-100 text-amber-800'
                                  : e.type === 'PERSON'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {e.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{e.source}</td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-700 font-bold">
                            {(e.confidence * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Keyphrases & Zod-Validated Structured Extraction */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Keyphrases */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-brand-600" />
                    Keyphrase Extraction (RAKE Algorithm)
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {extractionResult.keyphrases.map((kp, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200 flex items-center gap-1.5"
                      >
                        <span>{kp.phrase}</span>
                        <span className="text-[10px] font-bold text-slate-400">({kp.score})</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Structured Paper Schema Viewer */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        Zod-Validated Structured Paper Extraction
                      </h4>
                      <button
                        onClick={handleCopyJson}
                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-semibold cursor-pointer"
                      >
                        {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Structured extraction adhering to strict Zod schema validation.
                    </p>
                  </div>

                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto max-h-64 border border-slate-800">
                    {JSON.stringify(extractionResult.structuredData, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

