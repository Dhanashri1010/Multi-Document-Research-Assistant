import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink, Download, FileText, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from './Button.js';
import { LoadingState } from './LoadingState.js';
import { documentService } from '../../services/documentService.js';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  pageNumber?: number;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentName,
  pageNumber = 1,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        setBlobUrl(null);
      }
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const loadPdfBlob = async () => {
      try {
        const blob = await documentService.getFileBlob(documentId);
        if (!active) return;

        // Revoke any previous blob URL before setting new one
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
      } catch (err: any) {
        if (!active) return;
        const msg =
          err.response?.status === 401
            ? 'Your session has expired. Please log in again.'
            : err.message || 'Failed to securely load PDF.';
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPdfBlob();

    return () => {
      active = false;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
        setBlobUrl(null);
      }
    };
  }, [isOpen, documentId]);

  if (!isOpen || !documentId) return null;

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(`${blobUrl}#page=${pageNumber}`, '_blank');
    }
  };

  const handleDownload = () => {
    documentService.downloadFile(documentId, documentName);
  };

  const handleRetry = async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await documentService.getFileBlob(documentId);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setBlobUrl(url);
    } catch (err: any) {
      const msg =
        err.response?.status === 401
          ? 'Your session has expired. Please log in again.'
          : err.message || 'Failed to securely load PDF.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-4">
            <div className="p-1.5 rounded-lg bg-brand-50 text-brand-600 border border-brand-100 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-bold text-slate-800 truncate" title={documentName}>
                {documentName}
              </h3>
              <p className="text-xs text-slate-500">
                Opened at <span className="font-semibold text-brand-700">Page {pageNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!blobUrl}
              onClick={handleOpenNewTab}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/80 disabled:opacity-50 transition-colors border border-slate-300"
              title="Open full PDF in separate browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Tab</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/80 transition-colors border border-slate-300"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg"
              title="Close PDF viewer"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Embedded PDF frame or states */}
        <div className="flex-1 w-full bg-slate-100 relative flex items-center justify-center">
          {loading && (
            <div className="p-8">
              <LoadingState message="Fetching secure document preview..." />
            </div>
          )}

          {error && !loading && (
            <div className="max-w-md p-6 bg-white rounded-xl border border-rose-200 shadow-sm text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">Unable to load document</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{error}</p>
              <Button size="sm" variant="outline" onClick={handleRetry} icon={<RotateCcw className="w-3.5 h-3.5" />}>
                Retry Loading
              </Button>
            </div>
          )}

          {blobUrl && !loading && !error && (
            <iframe
              data-testid="pdf-viewer-iframe"
              src={`${blobUrl}#page=${pageNumber}`}
              title={`PDF Preview: ${documentName}`}
              className="w-full h-full border-0"
              allow="fullscreen"
            />
          )}
        </div>
      </div>
    </div>
  );
};
