import React from 'react';
import { X, ExternalLink, Download, FileText } from 'lucide-react';
import { Button } from './Button.js';

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
  if (!isOpen || !documentId) return null;

  const pdfUrl = `/api/documents/${documentId}/file#page=${pageNumber}`;

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
            <a
              href={`/api/documents/${documentId}/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/80 transition-colors border border-slate-300"
              title="Open full PDF in separate browser tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Tab</span>
            </a>
            <a
              href={`/api/documents/${documentId}/file`}
              download={documentName}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-200/80 transition-colors border border-slate-300"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
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

        {/* Embedded PDF frame */}
        <div className="flex-1 w-full bg-slate-100 relative">
          <iframe
            src={pdfUrl}
            title={documentName}
            className="w-full h-full border-0"
            allow="fullscreen"
          />
        </div>
      </div>
    </div>
  );
};

