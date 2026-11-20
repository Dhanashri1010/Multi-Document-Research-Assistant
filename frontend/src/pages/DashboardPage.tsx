import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  UploadCloud,
  Sparkles,
  ArrowRight,
  BookOpen,
  GitCompare,
  MessageSquare,
  History,
  RotateCcw,
  Loader2,
  Layers,
  Network,
  Tag,
} from 'lucide-react';
import { documentService } from '../services/documentService.js';
import { researchService } from '../services/researchService.js';
import { NlpService } from '../services/nlpService.js';
import { WorkspaceStats, IDocument } from '../types/document.js';
import { IResearchSession } from '../types/research.js';
import { ProcessingStatusBadge } from '../components/documents/ProcessingStatus.js';
import { Button } from '../components/common/Button.js';
import { LoadingState } from '../components/common/LoadingState.js';
import { ErrorMessage } from '../components/common/ErrorMessage.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Modal } from '../components/common/Modal.js';
import { DocumentUploader } from '../components/documents/DocumentUploader.js';
import { useWorkspace } from '../context/WorkspaceContext.js';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [recentDocs, setRecentDocs] = useState<IDocument[]>([]);
  const [recentSessions, setRecentSessions] = useState<IResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);
  const [selectedErrorDoc, setSelectedErrorDoc] = useState<IDocument | null>(null);
  const [themes, setThemes] = useState<any[]>([]);
  const [similarPairs, setSimilarPairs] = useState<{ docA: string; docB: string; score: number }[]>([]);

  const navigate = useNavigate();
  const { selectAllDocs, setSelectedDocIds, refreshDocuments } = useWorkspace();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, sessionsData] = await Promise.all([
        documentService.getStats(),
        researchService.getSessions().catch(() => []),
      ]);
      setStats(statsData.stats);
      setRecentDocs(statsData.recentDocuments);
      setRecentSessions(sessionsData.slice(0, 5));

      // Asynchronously load themes & similarities if >= 2 ready documents
      const readyDocs = statsData.recentDocuments.filter((d: IDocument) => d.status === 'ready');
      if (readyDocs.length >= 2) {
        const readyIds = readyDocs.map((d: IDocument) => d._id);
        NlpService.getTopics({ documentIds: readyIds, sampleMax: 60 })
          .then((topicRes: any) => {
            if (topicRes?.topics) {
              setThemes(topicRes.topics.slice(0, 4));
            }
          })
          .catch(() => {});

        NlpService.vectorizeDocuments(readyIds)
          .then((vecRes: any) => {
            if (vecRes?.matrix) {
              const pairs = vecRes.matrix
                .filter((m: any) => m.docAId !== m.docBId && m.denseSimilarity > 0.5)
                .slice(0, 4)
                .map((m: any) => ({
                  docA: m.docATitle,
                  docB: m.docBTitle,
                  score: Math.round(m.denseSimilarity * 100),
                }));
              setSimilarPairs(pairs);
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-refresh when any recent document is currently processing or uploaded
  useEffect(() => {
    const hasPending = recentDocs.some(
      (d) => d.status === 'processing' || d.status === 'uploaded'
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 3000);

    return () => clearInterval(interval);
  }, [recentDocs]);

  const handleRetryDocument = async (docId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setRetryingDocId(docId);
      await documentService.reprocess(docId);
      await fetchDashboardData();
      await refreshDocuments();
    } catch (err: any) {
      console.error('Failed to retry document:', err);
    } finally {
      setRetryingDocId(null);
    }
  };

  const handleUploadDone = async () => {
    setIsUploadOpen(false);
    await fetchDashboardData();
    await refreshDocuments();
  };

  const handleStartResearch = (docId?: string) => {
    if (docId) {
      selectAllDocs([docId]);
    } else {
      selectAllDocs();
    }
    navigate('/research');
  };

  const handleResumeSession = (session: IResearchSession) => {
    if (session.selectedDocumentIds && session.selectedDocumentIds.length > 0) {
      setSelectedDocIds(session.selectedDocumentIds);
    }
    navigate('/research');
  };

  if (loading) {
    return <LoadingState message="Connecting to research repository..." />;
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <ErrorMessage message={error} onRetry={fetchDashboardData} />
      </div>
    );
  }

  const hasDocuments = stats && stats.totalDocuments > 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <span className="text-xs font-bold text-brand-600 uppercase tracking-wider">
            Research Assistant
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5 tracking-tight">
            Research Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Easily explore, ask questions, and compare research papers or documents. Upload your files, select what you want to research, and get clear answers backed by direct citations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="md"
            icon={<UploadCloud className="w-4 h-4" />}
            onClick={() => setIsUploadOpen(true)}
          >
            Upload Documents
          </Button>

          {hasDocuments && (
            <Button
              variant="primary"
              size="md"
              icon={<Sparkles className="w-4 h-4" />}
              onClick={() => handleStartResearch()}
            >
              Start Research
            </Button>
          )}
        </div>
      </div>

      {/* Quick Start Guide for New Users */}
      <div className="bg-gradient-to-r from-brand-50/80 via-white to-blue-50/50 p-5 rounded-2xl border border-brand-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-brand-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">How to get started</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              1. <strong>Upload</strong> PDF, Word, or TXT documents &nbsp;→&nbsp; 2. <strong>Select</strong> papers in Workspace &nbsp;→&nbsp; 3. <strong>Ask</strong> questions to receive verified answers.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/documents')}
            icon={<FileText className="w-3.5 h-3.5 text-brand-600" />}
          >
            View Documents
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/compare')}
            icon={<GitCompare className="w-3.5 h-3.5 text-blue-600" />}
          >
            Compare Documents
          </Button>
        </div>
      </div>

      {/* Real Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Documents</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {stats?.totalDocuments ?? 0}
          </p>
          <p className="text-xs text-slate-400">Saved in your library</p>
        </div>

        {/* Ready Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Ready for Research</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
            {stats?.readyDocuments ?? 0}
          </p>
          <p className="text-xs text-slate-400">Ready to answer questions</p>
        </div>

        {/* Processing Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Preparing Documents</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-blue-600 tracking-tight">
            {stats?.processingDocuments ?? 0}
          </p>
          <p className="text-xs text-slate-400">Reading and indexing</p>
        </div>

        {/* Failed Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Processing Issues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 tracking-tight">
            {stats?.failedDocuments ?? 0}
          </p>
          <p className="text-xs text-slate-400">Needs retry or check</p>
        </div>
      </div>

      {/* Main Grid: Recent Documents & Recent Research Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Documents Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">Recent Documents</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Recently added documents ready for research.
              </p>
            </div>
            <Link
              to="/documents"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition-colors"
            >
              View All Documents <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!hasDocuments ? (
            <EmptyState
              icon={BookOpen}
              title="Your Research Repository is Empty"
              description="Upload your documents (PDF, Word, or Text) to start asking questions, finding key takeaways, and comparing findings."
              action={
                <Button
                  variant="primary"
                  size="md"
                  icon={<UploadCloud className="w-4 h-4" />}
                  onClick={() => setIsUploadOpen(true)}
                >
                  Upload Documents
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Document Title</th>
                    <th className="py-3 px-4 whitespace-nowrap">Pages</th>
                    <th className="py-3 px-4 whitespace-nowrap">Uploaded</th>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {recentDocs.map((doc) => (
                    <tr key={doc._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5 max-w-xs">
                          <FileText className="w-4 h-4 text-brand-500 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate" title={doc.originalName}>
                            {doc.title || doc.originalName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {doc.pageCount > 0 ? `${doc.pageCount} pgs` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(doc.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <ProcessingStatusBadge
                            status={doc.status}
                            message={doc.processingMessage}
                            embeddedChunkCount={doc.embeddedChunkCount}
                            totalChunkCount={doc.totalChunkCount}
                          />
                          {doc.status === 'failed' && doc.errorDetails && (
                            <button
                              onClick={() => setSelectedErrorDoc(doc)}
                              title="View error details"
                              className="p-1 rounded-md text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {doc.status === 'ready' ? (
                          <button
                            onClick={() => handleStartResearch(doc._id)}
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-semibold cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Research
                          </button>
                        ) : doc.status === 'failed' ? (
                          <button
                            onClick={(e) => handleRetryDocument(doc._id, e)}
                            disabled={retryingDocId === doc._id}
                            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold cursor-pointer disabled:opacity-50"
                            title={doc.errorDetails ? `Retry: ${doc.errorDetails}` : 'Retry processing this document'}
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${retryingDocId === doc._id ? 'animate-spin' : ''}`} />
                            <span>Retry</span>
                          </button>
                        ) : doc.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1.5 text-blue-600 font-medium text-xs whitespace-nowrap">
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            <span>Processing...</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-amber-600 font-medium text-xs whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>Queued</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Research Activity (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <History className="w-4 h-4 text-brand-600" />
                Recent Research
              </h3>
              <Link
                to="/research"
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition-colors"
              >
                Workspace <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Previous questions and research conversations.
            </p>

            <div className="mt-4 space-y-2">
              {recentSessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No research sessions yet.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/research')}
                  >
                    Start First Query
                  </Button>
                </div>
              ) : (
                recentSessions.map((session) => (
                  <div
                    key={session._id}
                    onClick={() => handleResumeSession(session)}
                    className="p-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-brand-700">
                        {session.title || 'Untitled Session'}
                      </p>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-brand-600 shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                      <span>
                        {new Date(session.updatedAt || session.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span>•</span>
                      <span>
                        {session.selectedDocumentIds?.length || 0} paper{session.selectedDocumentIds?.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Action Box */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Navigation
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => navigate('/compare')}
                icon={<GitCompare className="w-3.5 h-3.5 text-blue-600" />}
              >
                Compare
              </Button>
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={() => navigate('/documents')}
                icon={<FileText className="w-3.5 h-3.5 text-brand-600" />}
              >
                Documents
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cross-Document Themes & Semantic Clusters Card (when >= 2 documents) */}
      {(themes.length > 0 || similarPairs.length > 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                Library Themes & Document Relationships
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically discovered research clusters and semantic similarity across your indexed documents.
              </p>
            </div>
            <Link
              to="/insights"
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 transition-colors shrink-0"
            >
              Explore Insights & Clusters <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
            {/* Discovered Themes */}
            {themes.length > 0 && (
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Discovered Research Themes
                </span>
                <div className="space-y-2">
                  {themes.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {t.title || `Theme ${t.id + 1}`}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {t.size} passage{t.size === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.keywords?.slice(0, 4).map((kw: any, kidx: number) => {
                          const kwText = typeof kw === 'string' ? kw : (kw?.word || kw?.term || '');
                          if (!kwText) return null;
                          return (
                            <span
                              key={kidx}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-brand-50 text-brand-700"
                            >
                              {kwText}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Semantic Document Similarities */}
            {similarPairs.length > 0 && (
              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Top Document Connections
                </span>
                <div className="space-y-2">
                  {similarPairs.map((pair, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 truncate" title={pair.docA}>
                          {pair.docA}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate" title={pair.docB}>
                          <span className="text-slate-400">↔</span> {pair.docB}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {pair.score}% match
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Academic Papers"
        maxWidth="lg"
      >
        <DocumentUploader onUploadComplete={handleUploadDone} />
      </Modal>

      {/* Error Details Modal */}
      {selectedErrorDoc && (
        <Modal
          isOpen={!!selectedErrorDoc}
          onClose={() => setSelectedErrorDoc(null)}
          title="Document Processing Error"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-mono break-words">
              {selectedErrorDoc.errorDetails || 'An unexpected error occurred while processing this document.'}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              You can retry processing now or navigate to the Documents page to manage or replace the file.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedErrorDoc(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<RotateCcw className={`w-3.5 h-3.5 ${retryingDocId === selectedErrorDoc._id ? 'animate-spin' : ''}`} />}
                isLoading={retryingDocId === selectedErrorDoc._id}
                onClick={async () => {
                  const docId = selectedErrorDoc._id;
                  setSelectedErrorDoc(null);
                  await handleRetryDocument(docId);
                }}
              >
                Retry Processing
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
