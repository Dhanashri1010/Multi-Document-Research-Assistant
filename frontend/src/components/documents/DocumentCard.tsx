import React, { useState } from 'react';
import {
  FileText,
  Trash2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  FileSearch,
} from 'lucide-react';
import { IDocument } from '../../types/document.js';
import { ProcessingStatusBadge } from './ProcessingStatus.js';
import { Button } from '../common/Button.js';
import { Modal } from '../common/Modal.js';

interface DocumentCardProps {
  document: IDocument;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onReprocess: (id: string) => Promise<void>;
  onSummarize: (id: string) => void;
  onOpenResearch: (id: string) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  isSelected,
  onToggleSelect,
  onDelete,
  onReprocess,
  onSummarize,
  onOpenResearch,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

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
                className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug"
                title={document.originalName}
              >
                {document.originalName}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">Uploaded {formattedDate}</p>
            </div>
          </div>

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
              variant="outline"
              className="w-full text-rose-700 border-rose-300 hover:bg-rose-50"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              isLoading={isRetrying}
              onClick={handleReprocess}
            >
              Retry Ingestion
            </Button>
          )}

          {(document.status === 'processing' || document.status === 'uploaded') && (
            <div className="w-full text-center py-1.5 text-xs text-blue-600 font-medium animate-pulse">
              Extracting text & generating vectors...
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Document Deletion"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <strong className="text-slate-900">{document.originalName}</strong>?
          </p>
          <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            This will permanently remove the original file, all extracted text passages, and semantic vector embeddings from your database.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleDelete}
              icon={<Trash2 className="w-3.5 h-3.5" />}
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
        title="Ingestion Error Details"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 font-mono overflow-x-auto">
            {document.errorDetails || 'Unknown error occurred during document extraction or embedding.'}
          </div>
          <p className="text-xs text-slate-500">
            Common causes include password-protected PDFs, scanned image-only files with no embedded text, or temporary model timeouts.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowErrorModal(false)}>
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
              Retry Ingestion
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
