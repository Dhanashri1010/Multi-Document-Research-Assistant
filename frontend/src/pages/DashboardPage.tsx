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
} from 'lucide-react';
import { documentService } from '../services/documentService.js';
import { researchService } from '../services/researchService.js';
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
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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
            AI Research Knowledge Base
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5 tracking-tight">
            Research Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Multi-Document Research Assistant ingests literature, extracts structured passages, generates
            dense sentence embeddings, and conducts grounded Retrieval-Augmented Generation across your corpus.
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
              Open Research Workspace
            </Button>
          )}
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
          <p className="text-xs text-slate-400">Indexed in database</p>
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
          <p className="text-xs text-slate-400">Vector indexed & queryable</p>
        </div>

        {/* Processing Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Currently Ingesting</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-blue-600 tracking-tight">
            {stats?.processingDocuments ?? 0}
          </p>
          <p className="text-xs text-slate-400">Extracting & embedding</p>
        </div>

        {/* Failed Documents */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Failed Ingestion</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-rose-600 tracking-tight">
            {stats?.failedDocuments ?? 0}
          </p>
          <p className="text-xs text-slate-400">Action required</p>
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
                Latest papers processed into the semantic retrieval index.
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
              description="Upload research papers (PDF) to begin automatic text extraction, sentence chunking, dense vector embedding, and cross-document QA."
              action={
                <Button
                  variant="primary"
                  size="md"
                  icon={<UploadCloud className="w-4 h-4" />}
                  onClick={() => setIsUploadOpen(true)}
                >
                  Upload Research Papers
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Document Title</th>
                    <th className="py-3 px-4">Pages</th>
                    <th className="py-3 px-4">Uploaded</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
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
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {doc.pageCount > 0 ? `${doc.pageCount} pgs` : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(doc.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <ProcessingStatusBadge status={doc.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {doc.status === 'ready' ? (
                          <button
                            onClick={() => handleStartResearch(doc._id)}
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-semibold cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> Research
                          </button>
                        ) : (
                          <span className="text-slate-400 italic">Processing...</span>
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
              Previous QA dialogues and paper investigations.
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

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Academic Papers"
        maxWidth="lg"
      >
        <DocumentUploader onUploadComplete={handleUploadDone} />
      </Modal>
    </div>
  );
};
