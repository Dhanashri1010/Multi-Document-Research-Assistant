import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { documentService } from '../services/documentService.js';
import { IDocument, WorkspaceStats } from '../types/document.js';
import { DocumentUploader } from '../components/documents/DocumentUploader.js';
import { DocumentList } from '../components/documents/DocumentList.js';
import { DocumentDetailModal } from '../components/documents/DocumentDetailModal.js';
import { Button } from '../components/common/Button.js';
import { LoadingState } from '../components/common/LoadingState.js';
import { ErrorMessage } from '../components/common/ErrorMessage.js';
import { Modal } from '../components/common/Modal.js';
import { useWorkspace } from '../context/WorkspaceContext.js';

export const DocumentsPage: React.FC = () => {
  const { documents, loadingDocuments, refreshDocuments, selectAllDocs } = useWorkspace();
  const navigate = useNavigate();

  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail & Summary Modal state
  const [detailDoc, setDetailDoc] = useState<IDocument | null>(null);
  const [detailTab, setDetailTab] = useState<'summary' | 'pdf' | 'info'>('summary');
  const [initialPdfPage, setInitialPdfPage] = useState<number>(1);

  // Fetch live stats from backend
  const fetchStats = useCallback(async () => {
    try {
      const data = await documentService.getStats();
      setStats(data.stats);
    } catch (err) {
      console.warn('[DocumentsPage] Could not load backend stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, documents]);

  // Automatic polling if any document is currently in 'processing' or 'uploaded' state
  useEffect(() => {
    const hasPending = documents.some(
      (d) => d.status === 'processing' || d.status === 'uploaded'
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      refreshDocuments();
      fetchStats();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, refreshDocuments, fetchStats]);

  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);

  const handleReindexAll = async () => {
    try {
      setIsReindexing(true);
      setError(null);
      const res = await documentService.reindexAll();
      setReindexMessage(`Successfully re-indexed ${res.succeeded} of ${res.total} document(s).`);
      await refreshDocuments();
      await fetchStats();
      setTimeout(() => setReindexMessage(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Failed to re-index documents.');
    } finally {
      setIsReindexing(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([refreshDocuments(), fetchStats()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await documentService.delete(id);
      await Promise.all([refreshDocuments(), fetchStats()]);
    } catch (err: any) {
      setError(err.message || 'Failed to delete document.');
    }
  };

  const handleReprocess = async (id: string) => {
    try {
      await documentService.reprocess(id);
      await Promise.all([refreshDocuments(), fetchStats()]);
    } catch (err: any) {
      setError(err.message || 'Failed to reprocess document.');
    }
  };

  const handleUpdateCollection = async (id: string, col: string) => {
    try {
      await documentService.updateCollection(id, col);
      await refreshDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to update collection.');
    }
  };

  const handleOpenSummary = (id: string) => {
    const doc = documents.find((d) => d._id === id);
    if (!doc) return;
    setDetailDoc(doc);
    setDetailTab('summary');
    setInitialPdfPage(1);
  };

  const handleOpenPdf = (id: string, page: number = 1) => {
    const doc = documents.find((d) => d._id === id);
    if (!doc) return;
    setDetailDoc(doc);
    setDetailTab('pdf');
    setInitialPdfPage(page);
  };

  const handleOpenResearch = (id: string) => {
    selectAllDocs([id]);
    navigate('/research');
  };

  const handleUploadFinished = async () => {
    setIsUploadModalOpen(false);
    await Promise.all([refreshDocuments(), fetchStats()]);
  };

  // Compute stats fallback if backend stats are loading
  const totalCount = stats?.totalDocuments ?? documents.length;
  const readyCount = stats?.readyDocuments ?? documents.filter((d) => d.status === 'ready').length;
  const processingCount =
    stats?.processingDocuments ??
    documents.filter((d) => d.status === 'processing' || d.status === 'uploaded').length;
  const failedCount =
    stats?.failedDocuments ?? documents.filter((d) => d.status === 'failed').length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-7">
      {/* Top Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Document Repository
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Documents & Knowledge Base
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Upload, inspect, understand, and organize research papers, technical articles, and reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            isLoading={isRefreshing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReindexAll}
            isLoading={isReindexing}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Re-index
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            icon={<UploadCloud className="w-3.5 h-3.5" />}
          >
            Upload Documents
          </Button>
        </div>
      </div>

      {/* 3.A Statistics Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Total Documents</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block tracking-tight">
              {totalCount}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        {/* Successfully Processed */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Successfully Processed</span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block tracking-tight">
              {readyCount}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Currently Processing */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Currently Processing</span>
            <span className="text-2xl font-black text-amber-700 mt-1 block tracking-tight">
              {processingCount}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Clock className={`w-5 h-5 ${processingCount > 0 ? 'animate-spin' : ''}`} />
          </div>
        </div>

        {/* Failed Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Failed Documents</span>
            <span className="text-2xl font-black text-rose-700 mt-1 block tracking-tight">
              {failedCount}
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {reindexMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <span>{reindexMessage}</span>
          <button
            onClick={() => setReindexMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {error && <ErrorMessage message={error} onRetry={refreshDocuments} />}

      {/* Main Content Area */}
      {loadingDocuments && documents.length === 0 ? (
        <LoadingState message="Fetching repository documents and metrics..." />
      ) : (
        <DocumentList
          documents={documents}
          onDeleteDocument={handleDelete}
          onReprocessDocument={handleReprocess}
          onSummarizeDocument={handleOpenSummary}
          onOpenPdf={handleOpenPdf}
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onUpdateCollection={handleUpdateCollection}
        />
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload Academic Papers, Articles & Reports"
        maxWidth="lg"
      >
        <DocumentUploader onUploadComplete={handleUploadFinished} />
      </Modal>

      {/* Dedicated Document Detail & Adaptive Summary Modal */}
      <DocumentDetailModal
        document={detailDoc}
        isOpen={Boolean(detailDoc)}
        onClose={() => setDetailDoc(null)}
        initialTab={detailTab}
        initialPage={initialPdfPage}
        onOpenResearch={handleOpenResearch}
        onReprocess={handleReprocess}
      />
    </div>
  );
};
