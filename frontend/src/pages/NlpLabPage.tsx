import React, { useState } from 'react';
import { FlaskConical, Layers, Smile, Award } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.js';
import { PreprocessingTab } from '../components/nlp/PreprocessingTab.js';
import { SentimentExtractionTab } from '../components/nlp/SentimentExtractionTab.js';
import { EvaluationTab } from '../components/nlp/EvaluationTab.js';
import { IDocument } from '../types/document.js';

export const NlpLabPage: React.FC = () => {
  const { documents } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'preprocessing' | 'sentiment' | 'evaluation'>(
    'preprocessing'
  );

  // Default selected document to first ready document or first available
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
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
                Demonstrable NLP Course Rubric: Text Preprocessing, Vectorization, Sentiment, and Information Extraction with Empirical Evaluation
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div className="flex items-center gap-1.5 bg-slate-200/70 p-1.5 rounded-xl text-xs font-semibold select-none">
          <button
            onClick={() => setActiveTab('preprocessing')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'preprocessing'
                ? 'bg-white text-brand-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Preprocessing & Vectorization</span>
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
            <span>Sentiment & Extraction</span>
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

      {activeTab === 'evaluation' && <EvaluationTab />}
    </div>
  );
};
