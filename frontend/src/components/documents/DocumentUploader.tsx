import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle, CheckCircle2 } from 'lucide-react';
import { documentService } from '../../services/documentService.js';
import { Button } from '../common/Button.js';
import { IDocument } from '../../types/document.js';

interface DocumentUploaderProps {
  onUploadComplete?: (docs: IDocument[]) => void;
}

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);

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

  return (
    <div className="space-y-4">
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
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Uploading & Queueing Ingestion...</span>
            <span className="font-semibold">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error alert */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success alert */}
      {successCount !== null && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successCount} document(s) uploaded successfully! Ingestion pipeline started.</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="primary"
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || isUploading}
          isLoading={isUploading}
          icon={<UploadCloud className="w-4 h-4" />}
        >
          {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
        </Button>
      </div>
    </div>
  );
};
