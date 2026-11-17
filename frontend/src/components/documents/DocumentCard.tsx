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
  Download,
  Scale,
  FileCode,
  Briefcase,
  GraduationCap,
  Wrench,
} from 'lucide-react';
import { IDocument } from '../../types/document.js';
import { ProcessingStatusBadge } from './ProcessingStatus.js';
import { Button } from '../common/Button.js';
import { Modal } from '../common/Modal.js';
import { documentService } from '../../services/documentService.js';

interface DocumentCardProps {
  document: IDocument;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onReprocess: (id: string) => Promise<void>;
  onSummarize: (id: string) => void;
  onOpenPdf?: (id: string) => void;
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
  onOpenPdf,
  onOpenResearch,
  onUpdateCollection,
}) => {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Inline collection editing
  const [isEditingCollection, setIsEditingCollection] = useState(false);
  const [collectionInput, setCollectionInput] = useState(document.collectionName || 'General');

  const formattedDate = new Date(document.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const formattedSize = (document.fileSize / (1024 * 1024)).toFixed(2) + ' MB';
  const fileExt = document.originalName.split('.').pop()?.toUpperCase() || 'PDF';
  const docTitle = document.title || document.originalName.replace(/\.pdf$/i, '');

  const getCategoryIcon = (cat?: string) => {
    switch (cat) {
      case 'Research Paper':
      case 'Academic Article':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'Legal Document':
        return <Scale className="w-3.5 h-3.5" />;
      case 'Technical Document':
        return <FileCode className="w-3.5 h-3.5" />;
      case 'Business Report':
        return <Briefcase className="w-3.5 h-3.5" />;
      case 'Educational Material':
        return <GraduationCap className="w-3.5 h-3.5" />;
      case 'User Manual':
        return <Wrench className="w-3.5 h-3.5" />;
      default:
        return <FileText className="w-3.5 h-3.5" />;
    }
  };

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

  const handleDownload = () => {
    documentService.downloadFile(document._id, document.originalName);
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
        className={`p-5 rounded-2xl border transition-all bg-white flex flex-col justify-between ${
          isSelected
            ? 'border-brand-500 ring-2 ring-brand-100 shadow-md'
            : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        <div>
          {/* Card Top Row: Checkbox, Category, Status & Delete */}
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
                onClick={handleDownload}
                title="Download original file"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowDeleteModal(true)}
                title="Delete document"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Document Title & Icon */}
          <div className="flex items-start gap-3 mb-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0 mt-0.5">
              {getCategoryIcon(document.category)}
            </div>
            <div className="min-w-0 flex-1">
              <h4
                className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug cursor-pointer hover:text-brand-600 transition-colors"
                title={docTitle}
                onClick={() => onSummarize(document._id)}
              >
                {docTitle}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={document.originalName}>
                {document.originalName}
              </p>
            </div>
          </div>

          {/* Badges: Category & Collection */}
          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {document.category || 'General Document'}
            </span>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-50 text-slate-600 border border-slate-200">
              {fileExt}
            </span>

            <div className="flex items-center gap-1">
              <Folder className="w-3 h-3 text-slate-400 shrink-0" />
              {isEditingCollection ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={collectionInput}
                    onChange={(e) => setCollectionInput(e.target.value)}
                    className="px-1.5 py-0.5 text-xs border border-brand-300 rounded focus:outline-none"
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
                  className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 hover:bg-slate-100 text-[11px] font-medium cursor-pointer border border-slate-200"
                >
                  {document.collectionName || 'General'}
                </span>
              )}
            </div>
          </div>

          {/* Short description / abstract snippet if available */}
          {document.abstract && (
            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-3">
              {document.abstract}
            </p>
          )}

          {/* Low text density warning chip */}
          {(document.warning || document.isLowTextDensity) && (
            <div
              className="mb-3 p-2 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-1.5"
              title={document.warning || 'Low text density detected. OCR is recommended.'}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="line-clamp-2">Low text density · OCR recommended</span>
            </div>
          )}

          {/* User-friendly metadata chips (No chunk IDs, vector IDs, or internal dims!) */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400">Pages: </span>
              <span className="font-semibold text-slate-700">
                {document.pageCount > 0 ? document.pageCount : '1'}
              </span>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              <span className="text-slate-400">Size: </span>
              <span className="font-semibold text-slate-700">{formattedSize}</span>
            </div>
            <span className="text-slate-300">•</span>
            <div>
              <span className="text-slate-400">Uploaded: </span>
              <span className="font-semibold text-slate-700">{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Card Action Buttons */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
          <Button
            size="sm"
            variant="outline"
            className="px-2.5"
            icon={<BookOpen className="w-3.5 h-3.5" />}
            onClick={() => (onOpenPdf ? onOpenPdf(document._id) : onSummarize(document._id))}
            title="Read original PDF document"
          >
            Read
          </Button>

          {document.status === 'ready' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                icon={<FileSearch className="w-3.5 h-3.5" />}
                onClick={() => onSummarize(document._id)}
                title="View document summary and key findings"
              >
                Summary
              </Button>
              <Button
                size="sm"
                variant="primary"
                className="flex-1"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                onClick={() => onOpenResearch(document._id)}
                title="Open Research Workspace with this document"
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
            <div className="flex-1 py-1 px-3 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 border border-amber-200">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Indexing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Document Confirmation"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-900 font-semibold">{document.originalName}</strong>?
          </p>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-1">
            <p className="font-bold">This operation will permanently remove:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>The document metadata and database record</li>
              <li>All extracted chunks and vector embeddings</li>
              <li>Stored physical PDF file on disk</li>
            </ul>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={isDeleting}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Error Details Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Processing Error Details"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-1">
              Error Message
            </h4>
            <p className="text-xs text-rose-800 leading-relaxed font-mono whitespace-pre-wrap">
              {document.errorDetails || 'An unexpected error occurred during document ingestion.'}
            </p>
          </div>
          <p className="text-xs text-slate-500">
            You can attempt to reprocess this document. If it is password-protected or image-only,
            please upload an unencrypted or OCR-processed version.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowErrorModal(false)}
            >
              Dismiss
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setShowErrorModal(false);
                handleReprocess();
              }}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Retry Ingestion
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
