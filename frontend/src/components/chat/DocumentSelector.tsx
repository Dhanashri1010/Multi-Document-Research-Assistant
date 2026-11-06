import React, { useState } from 'react';
import { Search, Files, CheckSquare, Square, FileSearch, Folder } from 'lucide-react';
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
  const [selectedCollection, setSelectedCollection] = useState<string>('all');

  const readyDocs = documents.filter((d) => d.status === 'ready');

  const collections = Array.from(
    new Set(readyDocs.map((d) => d.collectionName || 'General'))
  ).sort();

  const filtered = readyDocs.filter((d) => {
    const matchesSearch = d.originalName.toLowerCase().includes(search.toLowerCase());
    const matchesCollection =
      selectedCollection === 'all' || (d.collectionName || 'General') === selectedCollection;
    return matchesSearch && matchesCollection;
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((d) => selectedDocIds.includes(d._id));

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

        {/* Collection Filter Dropdown */}
        {collections.length > 1 && (
          <div className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full py-1 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">All Collections ({readyDocs.length})</option>
              {collections.map((c) => (
                <option key={c} value={c}>
                  {c} ({readyDocs.filter((d) => (d.collectionName || 'General') === c).length})
                </option>
              ))}
            </select>
          </div>
        )}

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
            onClick={allFilteredSelected ? onClearAll : onSelectAll}
            className="text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
          >
            {allFilteredSelected ? (
              <>
                <Square className="w-3.5 h-3.5" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Select All Ready</span>
              </>
            )}
          </button>
          <span className="text-slate-400 text-[11px]">
            {filtered.length} paper{filtered.length !== 1 ? 's' : ''} shown
          </span>
        </div>
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            No ready documents match your filter.
          </div>
        ) : (
          filtered.map((doc) => {
            const isSelected = selectedDocIds.includes(doc._id);
            return (
              <div
                key={doc._id}
                onClick={() => onToggleSelect(doc._id)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all my-1 ${
                  isSelected
                    ? 'bg-brand-50/70 border border-brand-200 shadow-2xs'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="mt-0.5 shrink-0 text-brand-600">
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 fill-brand-600 text-white" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-semibold truncate ${
                      isSelected ? 'text-brand-900' : 'text-slate-800'
                    }`}
                    title={doc.originalName}
                  >
                    {doc.originalName}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span>{doc.pageCount} pages</span>
                    <span>•</span>
                    <span>{doc.chunkCount} chunks</span>
                    {doc.collectionName && doc.collectionName !== 'General' && (
                      <>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-medium text-[10px] border border-indigo-200">
                          {doc.collectionName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  title="Generate Executive Document Summary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSummarize(doc._id);
                  }}
                  className="p-1 hover:bg-white rounded text-slate-400 hover:text-brand-600 border border-transparent hover:border-slate-200 transition-colors shrink-0"
                >
                  <FileSearch className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
