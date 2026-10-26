import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, GitCompare, FileText, CheckSquare, Square } from 'lucide-react';
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
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  onDeleteDocument,
  onReprocessDocument,
  onSummarizeDocument,
  onOpenUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { selectedDocIds, toggleSelectDoc, selectAllDocs, clearSelectedDocs } = useWorkspace();

  const filteredDocs = documents.filter((doc) =>
    doc.originalName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      {/* Search and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search documents by filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
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
            description={`No document matched "${searchQuery}". Check the filename spelling or clear your search.`}
            action={
              <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                Clear Search
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
