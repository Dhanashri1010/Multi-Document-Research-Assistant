import React, { useState } from 'react';
import {
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  FileSearch,
  BookOpen,
  Folder,
  Check,
} from 'lucide-react';
import { IDocument } from '../../types/document.js';
import { ProcessingStatusBadge } from './ProcessingStatus.js';
import { Button } from '../common/Button.js';
import { Modal } from '../common/Modal.js';
import { PdfViewerModal } from '../common/PdfViewerModal.js';

interface DocumentCardProps {
  document: IDocument;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onReprocess: (id: string) => Promise<void>;
  onSummarize: (id: string) => void;
  onOpenResearch: (id: string) => void;
  onUpdateCollection?: (id: string, col: string) => Promise<void>;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  isSelected,
  onToggleSelect,
  onDelete,
  onReprocess,
  onSummarize,
  onOpenResearch,
  onUpdateCollection,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Inline collection editing
  const [isEditingCollection, setIsEditingCollection] = useState(false);
  const [collectionInput, setCollectionInput] = useState(document.collectionName || 'General');

  const formattedDate = new Date(document.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedSize = (document.fileSize / (1024 * 1024)).toFixed(2) + ' MB';

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete(document._id);
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReprocess = async () => {
    try {
      setIsRetrying(true);
      await onReprocess(document._id);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSaveCollection = async () => {
    if (onUpdateCollection) {
      await onUpdateCollection(document._id, collectionInput.trim() || 'General');
    }
    setIsEditingCollection(false);
  };

  return (
    <>
      <div
        className={`p-4 rounded-xl border transition-all bg-white flex flex-col justify-between ${
          isSelected
            ? 'border-brand-500 ring-2 ring-brand-100 shadow-sm'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        <div>
          {/* Card Top Row: Checkbox, Status & Delete */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(document._id)}
                disabled={document.status !== 'ready'}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 disabled:opacity-40"
              />
              <span className="text-xs font-semibold text-slate-500">Select</span>
            </label>

            <div className="flex items-center gap-1.5">
              <ProcessingStatusBadge status={document.status} />

              {document.status === 'failed' && (
                <button
                  onClick={() => setShowErrorModal(true)}
                  title="View error details"
                  className="p-1 rounded-md text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  <AlertCircle className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setShowDeleteModal(true)}
                title="Delete document"
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Document Title & Icon */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4
                className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug cursor-pointer hover:text-brand-600"
                title={document.originalName}
                onClick={() => setShowPdfModal(true)}
              >
                {document.originalName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Uploaded {formattedDate}</p>
            </div>
          </div>

          {/* Collection Tag */}
          <div className="mb-3 flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {isEditingCollection ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={collectionInput}
                  onChange={(e) => setCollectionInput(e.target.value)}
                  className="px-2 py-0.5 text-xs border border-brand-300 rounded focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveCollection}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                  title="Save collection"
                >
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span
                onClick={() => setIsEditingCollection(true)}
                title="Click to edit collection"
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 text-[11px] font-medium cursor-pointer border border-slate-200"
              >
                {document.collectionName || 'General'}
              </span>
            )}
          </div>

          {/* Low text density warning chip */}
          {(document.warning || document.isLowTextDensity) && (
            <div
              className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-1.5"
              title={document.warning || 'Low text density detected. OCR is recommended for scanned / slide PDFs.'}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="line-clamp-2">Low text density · OCR recommended</span>
            </div>
          )}

          {/* Metadata chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
            <div>
              <span className="text-slate-400">Pages: </span>
              <span className="font-semibold text-slate-700">
                {document.pageCount > 0 ? document.pageCount : '—'}
              </span>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              <span className="text-slate-400">Chunks: </span>
              <span className="font-semibold text-slate-700">
                {document.chunkCount > 0 ? document.chunkCount : '—'}
              </span>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              <span className="text-slate-400">Size: </span>
              <span className="font-semibold text-slate-700">{formattedSize}</span>
            </div>
          </div>
        </div>

        {/* Card Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <Button
            size="sm"
            variant="outline"
            className="px-2"
            icon={<BookOpen className="w-3.5 h-3.5" />}
            onClick={() => setShowPdfModal(true)}
            title="View PDF document"
          >
            PDF
          </Button>

          {document.status === 'ready' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                icon={<FileSearch className="w-3.5 h-3.5" />}
                onClick={() => onSummarize(document._id)}
              >
                Summarize
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="flex-1"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                onClick={() => onOpenResearch(document._id)}
              >
                Research
              </Button>
            </>
          )}

          {document.status === 'failed' && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-rose-700 hover:bg-rose-50"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />}
              isLoading={isRetrying}
              onClick={handleReprocess}
            >
              Retry Ingestion
            </Button>
          )}

          {document.status === 'processing' && (
            <div className="flex-1 text-center py-1.5 text-xs text-slate-400 font-medium">
              Indexing chunks...
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Research Document"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong className="text-slate-900">{document.originalName}</strong>?
            All parsed sections, vectors, and embeddings will be permanently removed.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDelete}
            >
              Delete Document
            </Button>
          </div>
        </div>
      </Modal>

      {/* Error Details Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Processing Failure Details"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            <p className="font-semibold mb-1">Error Information:</p>
            <p className="font-mono whitespace-pre-wrap">
              {document.errorDetails || 'An unspecified error occurred during extraction or embedding generation.'}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowErrorModal(false)}
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              isLoading={isRetrying}
              onClick={async () => {
                setShowErrorModal(false);
                await handleReprocess();
              }}
            >
              Retry Processing
            </Button>
          </div>
        </div>
      </Modal>

      {/* In-app PDF Viewer Modal */}
      <PdfViewerModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        documentId={document._id}
        documentName={document.originalName}
        pageNumber={1}
      />
    </>
  );
};
