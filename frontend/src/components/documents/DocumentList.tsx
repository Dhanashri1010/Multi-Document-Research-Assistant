import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, GitCompare, FileText, CheckSquare, Square, Folder } from 'lucide-react';
import { IDocument } from '../../types/document.js';
import { DocumentCard } from './DocumentCard.js';
import { Button } from '../common/Button.js';
import { EmptyState } from '../common/EmptyState.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';

interface DocumentListProps {
  documents: IDocument[];
  onDeleteDocument: (id: string) => Promise<void>;
  onReprocessDocument: (id: string) => Promise<void>;
  onSummarizeDocument: (id: string) => void;
  onOpenUpload: () => void;
  onUpdateCollection?: (id: string, col: string) => Promise<void>;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onDeleteDocument,
  onReprocessDocument,
  onSummarizeDocument,
  onOpenUpload,
  onUpdateCollection,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('all');
  const navigate = useNavigate();
  const { selectedDocIds, toggleSelectDoc, selectAllDocs, clearSelectedDocs } = useWorkspace();

  const collections = Array.from(
    new Set(documents.map((d) => d.collectionName || 'General'))
  ).sort();

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.originalName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCollection =
      selectedCollection === 'all' || (doc.collectionName || 'General') === selectedCollection;
    return matchesSearch && matchesCollection;
  });

  const readyDocs = documents.filter((d) => d.status === 'ready');
  const allReadySelected =
    readyDocs.length > 0 && readyDocs.every((d) => selectedDocIds.includes(d._id));

  const handleToggleSelectAll = () => {
    if (allReadySelected) {
      clearSelectedDocs();
    } else {
      selectAllDocs();
    }
  };

  const handleResearchSelected = () => {
    navigate('/research');
  };

  const handleCompareSelected = () => {
    navigate('/compare');
  };

  const handleSingleDocResearch = (id: string) => {
    selectAllDocs([id]);
    navigate('/research');
  };

  return (
    <div className="space-y-5">
      {/* Search, Collection Filter, and Action Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-1 items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search documents by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
            />
          </div>

          {/* Collection Filter */}
          {collections.length > 1 && (
            <div className="flex items-center gap-1.5">
              <Folder className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">All Collections ({documents.length})</option>
                {collections.map((c) => (
                  <option key={c} value={c}>
                    {c} ({documents.filter((d) => (d.collectionName || 'General') === c).length})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {readyDocs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleSelectAll}
              icon={allReadySelected ? <CheckSquare className="w-4 h-4 text-brand-600" /> : <Square className="w-4 h-4" />}
            >
              {allReadySelected ? 'Deselect All' : 'Select All Ready'}
            </Button>
          )}

          {selectedDocIds.length > 0 && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={handleResearchSelected}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Research ({selectedDocIds.length})
              </Button>

              {selectedDocIds.length >= 2 && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCompareSelected}
                  icon={<GitCompare className="w-4 h-4" />}
                >
                  Compare ({selectedDocIds.length})
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Document Grid */}
      {filteredDocs.length === 0 ? (
        documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Documents Uploaded Yet"
            description="Upload research papers or technical PDFs to begin multi-document vector semantic retrieval and AI analysis."
            action={
              <Button variant="primary" size="md" onClick={onOpenUpload}>
                Upload First Document
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No Matching Documents Found"
            description={`No document matched your filter criteria. Check spelling or select "All Collections".`}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCollection('all');
                }}
              >
                Reset Filters
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <DocumentCard
              key={doc._id}
              document={doc}
              isSelected={selectedDocIds.includes(doc._id)}
              onToggleSelect={toggleSelectDoc}
              onDelete={onDeleteDocument}
              onReprocess={onReprocessDocument}
              onSummarize={onSummarizeDocument}
              onOpenResearch={handleSingleDocResearch}
              onUpdateCollection={onUpdateCollection}
            />
          ))}
        </div>
      )}
    </div>
  );
};
