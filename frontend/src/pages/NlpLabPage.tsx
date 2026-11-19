import React, { useState, useEffect } from 'react';
import { FlaskConical, Layers, Smile, Award, Network, Globe, Flame, Loader2, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.js';
import { PreprocessingTab } from '../components/nlp/PreprocessingTab.js';
import { SentimentExtractionTab } from '../components/nlp/SentimentExtractionTab.js';
import { EvaluationTab } from '../components/nlp/EvaluationTab.js';
import { TopicModelingTab } from '../components/nlp/TopicModelingTab.js';
import { MultilingualTab } from '../components/nlp/MultilingualTab.js';
import { PromptPlaygroundTab } from '../components/nlp/PromptPlaygroundTab.js';
import { NlpService, LLMQuotaStatus } from '../services/nlpService.js';
import { IDocument } from '../types/document.js';

export const NlpLabPage: React.FC = () => {
  const { documents } = useWorkspace();
  const [activeTab, setActiveTab] = useState<
    'preprocessing' | 'sentiment' | 'topics' | 'multilingual' | 'playground' | 'evaluation'
  >('preprocessing');

  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [quota, setQuota] = useState<LLMQuotaStatus | null>(null);
  const [warming, setWarming] = useState(false);
  const [warmSuccess, setWarmSuccess] = useState(false);

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const currentDoc =
    documents.find((d) => d._id === selectedDocId) ||
    readyDocs[0] ||
    documents[0] ||
    null;

  const handleSelectDoc = (doc: IDocument) => {
    setSelectedDocId(doc._id);
  };

  const loadQuota = async () => {
    try {
      const q = await NlpService.getLlmQuota();
      setQuota(q);
    } catch {
      // ignore offline
    }
  };

  useEffect(() => {
    loadQuota();
  }, [activeTab]);

  const handleWarmCache = async () => {
    setWarming(true);
    setWarmSuccess(false);
    try {
      await NlpService.warmCache();
      setWarmSuccess(true);
      await loadQuota();
      setTimeout(() => setWarmSuccess(false), 4000);
    } catch (err: any) {
      console.error(err);
    } finally {
      setWarming(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                NLP Laboratory
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Demonstrable NLP Course Rubric: CO1 (Preprocessing/Vectors), CO2 (Sentiment/IE/Eval), CO3 (Topic Modeling/Multilingual), and CO4 (GenAI/Prompts)
              </p>
            </div>
          </div>
        </div>

        {/* Quota & Warm Cache Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {quota && (
            <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center gap-2">
              <span className="font-semibold text-slate-600">Gemini Quota:</span>
              <span className="font-mono font-bold text-brand-700">
                {quota.dailyUsage}/{quota.dailyLimit}
              </span>
              <span className="text-[11px] text-slate-400">
                ({quota.remainingDaily} left, resets 00:00 UTC)
              </span>
            </div>
          )}

          <button
            onClick={handleWarmCache}
            disabled={warming}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              warmSuccess
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
            }`}
            title="Pre-computes and caches results for sample documents so the presentation never waits on rate limits."
          >
            {warming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Warming Cache...</span>
              </>
            ) : warmSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cache Warmed!</span>
              </>
            ) : (
              <>
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>Warm Demo Cache</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tab Navigation Pill Bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-200/70 p-1.5 rounded-xl text-xs font-semibold select-none">
        <button
          onClick={() => setActiveTab('preprocessing')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'preprocessing'
              ? 'bg-white text-brand-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>CO1: Preprocessing & Vectorization</span>
        </button>

        <button
          onClick={() => setActiveTab('sentiment')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'sentiment'
              ? 'bg-white text-brand-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smile className="w-4 h-4" />
          <span>CO2: Sentiment & Extraction</span>
        </button>

        <button
          onClick={() => setActiveTab('topics')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'topics'
              ? 'bg-white text-brand-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>CO3: Topic Modeling</span>
        </button>

        <button
          onClick={() => setActiveTab('multilingual')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'multilingual'
              ? 'bg-white text-brand-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>CO3: Multilingual NLP</span>
        </button>

        <button
          onClick={() => setActiveTab('playground')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'playground'
              ? 'bg-white text-brand-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>CO4: Prompt Playground & Synthesis</span>
        </button>

        <button
          onClick={() => setActiveTab('evaluation')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'evaluation'
              ? 'bg-white text-brand-700 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Evaluation Benchmark</span>
        </button>
      </div>

      {/* Tab Content Display */}
      {activeTab === 'preprocessing' && (
        <PreprocessingTab
          documents={documents}
          selectedDoc={currentDoc}
          onSelectDoc={handleSelectDoc}
        />
      )}

      {activeTab === 'sentiment' && (
        <SentimentExtractionTab
          documents={documents}
          selectedDoc={currentDoc}
          onSelectDoc={handleSelectDoc}
        />
      )}

      {activeTab === 'topics' && (
        <TopicModelingTab documents={documents} />
      )}

      {activeTab === 'multilingual' && (
        <MultilingualTab documents={documents} />
      )}

      {activeTab === 'playground' && (
        <PromptPlaygroundTab documents={documents} />
      )}

      {activeTab === 'evaluation' && <EvaluationTab />}
    </div>
  );
};
