import React, { useState } from 'react';
import {
  Layers,
  Smile,
  Network,
  Globe,
  BookOpen,
  Sliders,
  Award,
  Sparkles,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.js';
import { PreprocessingTab } from '../components/nlp/PreprocessingTab.js';
import { SentimentExtractionTab } from '../components/nlp/SentimentExtractionTab.js';
import { EvaluationTab } from '../components/nlp/EvaluationTab.js';
import { TopicModelingTab } from '../components/nlp/TopicModelingTab.js';
import { MultilingualTab } from '../components/nlp/MultilingualTab.js';
import { PromptPlaygroundTab } from '../components/nlp/PromptPlaygroundTab.js';
import { IDocument } from '../types/document.js';

export type InsightTabKey =
  | 'text-analysis'
  | 'tone-info'
  | 'themes'
  | 'translate'
  | 'literature-review'
  | 'prompt-studio'
  | 'model-quality';

interface TabConfig {
  key: InsightTabKey;
  label: string;
  description: string;
  icon: React.ElementType;
  badge?: string;
}

const TABS: TabConfig[] = [
  {
    key: 'text-analysis',
    label: 'Text Analysis',
    description:
      'Examine text extraction, tokenization, stopword filtering, vocabulary metrics, and document similarities.',
    icon: Layers,
  },
  {
    key: 'tone-info',
    label: 'Tone & Key Information',
    description:
      'Analyze document sentiment, extract key entities (people, organizations, datasets, metrics), and identify main keyphrases.',
    icon: Smile,
  },
  {
    key: 'themes',
    label: 'Themes',
    description:
      'Discover underlying semantic themes across your research collection with automated clustering.',
    icon: Network,
  },
  {
    key: 'translate',
    label: 'Translate',
    description:
      'Translate document excerpts or ask questions in any language and receive answers in that language.',
    icon: Globe,
  },
  {
    key: 'literature-review',
    label: 'Literature Review',
    description:
      'Synthesize multiple research papers into an objective academic literature review with contradiction analysis.',
    icon: BookOpen,
  },
  {
    key: 'prompt-studio',
    label: 'Prompt Studio (advanced)',
    description:
      'Experiment with zero-shot, few-shot, and chain-of-thought prompt engineering strategies.',
    icon: Sliders,
    badge: 'Advanced',
  },
  {
    key: 'model-quality',
    label: 'Model Quality (advanced)',
    description:
      'Empirical evaluation of lexicon vs LLM sentiment and structured entity extraction performance.',
    icon: Award,
    badge: 'Advanced',
  },
];

export const NlpLabPage: React.FC = () => {
  const { documents } = useWorkspace();
  const [activeTab, setActiveTab] = useState<InsightTabKey>('text-analysis');
  const [selectedDocId, setSelectedDocId] = useState<string>('');

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const currentDoc =
    documents.find((d) => d._id === selectedDocId) ||
    readyDocs[0] ||
    documents[0] ||
    null;

  const handleSelectDoc = (doc: IDocument) => {
    setSelectedDocId(doc._id);
  };

  const activeTabMeta = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Product Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Insights
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Deep linguistic analysis, semantic themes, multilingual translation, and literature synthesis.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Purpose-Driven Tab Navigation Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-semibold select-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-brand-700 shadow-sm border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Description Callout */}
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl px-4 py-2.5 flex items-center gap-2.5 text-xs text-slate-600">
          <div className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />
          <span className="font-medium">{activeTabMeta.description}</span>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'text-analysis' && (
        <PreprocessingTab
          documents={documents}
          selectedDoc={currentDoc}
          onSelectDoc={handleSelectDoc}
        />
      )}

      {activeTab === 'tone-info' && (
        <SentimentExtractionTab
          documents={documents}
          selectedDoc={currentDoc}
          onSelectDoc={handleSelectDoc}
        />
      )}

      {activeTab === 'themes' && <TopicModelingTab documents={documents} />}

      {activeTab === 'translate' && <MultilingualTab documents={documents} />}

      {activeTab === 'literature-review' && (
        <PromptPlaygroundTab documents={documents} section="literature" />
      )}

      {activeTab === 'prompt-studio' && (
        <PromptPlaygroundTab documents={documents} section="studio" />
      )}

      {activeTab === 'model-quality' && <EvaluationTab />}
    </div>
  );
};
