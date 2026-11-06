import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { documentService } from '../../services/documentService.js';
import { Button } from '../common/Button.js';
import { IDocument } from '../../types/document.js';

interface DocumentUploaderProps {
  onUploadComplete?: (docs: IDocument[]) => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadComplete }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'arxiv'>('local');

  // Local file state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // arXiv import state
  const [arxivUrl, setArxivUrl] = useState('');
  const [arxivCollection, setArxivCollection] = useState('arXiv');
  const [isImportingArxiv, setIsImportingArxiv] = useState(false);

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFiles = (files: FileList | File[]): File[] => {
    const valid: File[] = [];
    const maxSizeBytes = 25 * 1024 * 1024; // 25MB

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setErrorMessage(`"${file.name}" is not a PDF. Only PDF research papers are supported.`);
        return [];
      }
      if (file.size > maxSizeBytes) {
        setErrorMessage(`"${file.name}" exceeds the 25MB file size limit.`);
        return [];
      }
      valid.push(file);
    }
    setErrorMessage(null);
    return valid;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const valid = validateFiles(e.target.files);
      if (valid.length > 0) {
        setSelectedFiles(valid);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const valid = validateFiles(e.dataTransfer.files);
      if (valid.length > 0) {
        setSelectedFiles(valid);
      }
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setIsUploading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setUploadProgress(10);

      const uploadedDocs = await documentService.upload(selectedFiles, (percent) => {
        setUploadProgress(percent);
      });

      setSuccessCount(uploadedDocs.length);
      setSelectedFiles([]);
      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete(uploadedDocs);
        }, 800);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleArxivImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arxivUrl.trim()) return;

    try {
      setIsImportingArxiv(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const doc = await documentService.importArxiv(arxivUrl.trim(), arxivCollection.trim());
      setSuccessMessage(`Successfully imported ${doc.originalName} into collection "${doc.collectionName || 'arXiv'}"`);
      setArxivUrl('');

      if (onUploadComplete) {
        setTimeout(() => {
          onUploadComplete([doc]);
        }, 800);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import arXiv paper.');
    } finally {
      setIsImportingArxiv(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('local');
            setErrorMessage(null);
          }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'local'
              ? 'border-brand-600 text-brand-700 bg-brand-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload Local PDFs</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('arxiv');
            setErrorMessage(null);
          }}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'arxiv'
              ? 'border-brand-600 text-brand-700 bg-brand-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Import from arXiv</span>
        </button>
      </div>

      {activeTab === 'local' ? (
        <>
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-brand-500 bg-brand-50/60 scale-[0.99]'
                : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-brand-600 mx-auto mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>

            <p className="text-sm font-semibold text-slate-800">
              Click to upload or drag & drop research PDFs
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports multiple PDFs (max 25MB each). Academic papers, technical reports, and preprints.
            </p>
          </div>

          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Selected for Ingestion ({selectedFiles.length})
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <File className="w-4 h-4 text-brand-500 shrink-0" />
                      <span className="truncate font-medium">{f.name}</span>
                    </div>
                    <span className="text-slate-400 shrink-0 font-mono">
                      {(f.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                ))}
              </div>

              {/* Upload Action */}
              <div className="pt-2 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                  disabled={isUploading}
                >
                  Clear Selection
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleUpload}
                  isLoading={isUploading}
                >
                  {isUploading ? `Ingesting (${uploadProgress}%)` : `Ingest ${selectedFiles.length} Paper(s)`}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* arXiv Import Form */
        <form onSubmit={handleArxivImport} className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              arXiv Paper URL or ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={arxivUrl}
                onChange={(e) => setArxivUrl(e.target.value)}
                placeholder="e.g. https://arxiv.org/abs/2106.09685 or 2106.09685"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                disabled={isImportingArxiv}
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Paste any arXiv abstract or PDF link. The assistant will download and chunk the paper automatically.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Assign to Collection / Project (Optional)
            </label>
            <input
              type="text"
              value={arxivCollection}
              onChange={(e) => setArxivCollection(e.target.value)}
              placeholder="e.g. LLM Efficiency, Transformers, Computer Vision"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              disabled={isImportingArxiv}
            />
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isImportingArxiv}
              disabled={!arxivUrl.trim() || isImportingArxiv}
              className="flex items-center gap-1.5"
            >
              {isImportingArxiv ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading & Ingesting...</span>
                </>
              ) : (
                <>
                  <span>Fetch & Ingest Paper</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Error state */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2 text-xs">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success state */}
      {(successCount !== null || successMessage) && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {successMessage || `Successfully uploaded and queued ${successCount} document(s) for ingestion.`}
          </span>
        </div>
      )}
    </div>
  );
};
