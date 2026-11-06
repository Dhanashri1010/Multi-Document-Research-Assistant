import React, { useState } from 'react';
import { Search, Files, CheckSquare, Square, FileSearch } from 'lucide-react';
import { IDocument } from '../../types/document.js';

interface DocumentSelectorProps {
  documents: IDocument[];
  selectedDocIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onSummarize: (id: string) => void;
}

export const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  documents,
  selectedDocIds,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onSummarize,
}) => {
  const [search, setSearch] = useState('');

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const filtered = readyDocs.filter((d) =>
    d.originalName.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected = readyDocs.length > 0 && readyDocs.every((d) => selectedDocIds.includes(d._id));

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Files className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-800">Target Documents</h3>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
            {selectedDocIds.length} / {readyDocs.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter papers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            onClick={allSelected ? onClearAll : onSelectAll}
            className="text-brand-600 hover:text-brand-800 font-semibold inline-flex items-center gap-1 transition-colors"
          >
            {allSelected ? (
              <>
                <CheckSquare className="w-3.5 h-3.5" /> Deselect All
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5" /> Select All ({readyDocs.length})
              </>
            )}
          </button>
          {selectedDocIds.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {readyDocs.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
            No ready documents available. Upload PDFs in the Documents page to begin research.
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            No papers match "{search}"
          </div>
        ) : (
          filtered.map((doc) => {
            const isSelected = selectedDocIds.includes(doc._id);
            return (
              <div
                key={doc._id}
                className={`p-2.5 rounded-lg border transition-all text-xs flex flex-col gap-1.5 ${
                  isSelected
                    ? 'border-brand-500 bg-brand-50/50 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div
                  className="flex items-start gap-2 cursor-pointer select-none"
                  onClick={() => onToggleSelect(doc._id)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by parent onClick
                    className="w-3.5 h-3.5 mt-0.5 rounded text-brand-600 focus:ring-brand-500 border-slate-300 pointer-events-none"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 leading-snug line-clamp-2">
                      {doc.originalName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span>{doc.pageCount} pages</span>
                      <span>•</span>
                      <span>{doc.chunkCount} passages</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1 border-t border-slate-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSummarize(doc._id);
                    }}
                    className="text-[11px] text-brand-600 hover:text-brand-800 font-medium inline-flex items-center gap-1"
                  >
                    <FileSearch className="w-3 h-3" /> Quick Summary
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
