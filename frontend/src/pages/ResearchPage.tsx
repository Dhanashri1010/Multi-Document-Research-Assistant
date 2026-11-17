import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  GitCompare,
  PlusCircle,
  Trash2,
  FileSearch,
  AlertCircle,
  Loader2,
  FileText,
  History,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.js';
import { researchService } from '../services/researchService.js';
import { documentService } from '../services/documentService.js';
import { IChatMessage, IResearchSession } from '../types/research.js';
import { DocumentSummary } from '../types/document.js';
import { DocumentSelector } from '../components/chat/DocumentSelector.js';
import { SessionHistoryDrawer } from '../components/chat/SessionHistoryDrawer.js';
import { ChatMessage } from '../components/chat/ChatMessage.js';
import { ChatInput } from '../components/chat/ChatInput.js';
import { Button } from '../components/common/Button.js';
import { Modal } from '../components/common/Modal.js';
import { SummaryPanel } from '../components/research/SummaryPanel.js';
import { ErrorMessage } from '../components/common/ErrorMessage.js';
import { LoadingState } from '../components/common/LoadingState.js';

export const ResearchPage: React.FC = () => {
  const { documents, selectedDocIds, setSelectedDocIds, toggleSelectDoc, selectAllDocs, clearSelectedDocs } =
    useWorkspace();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Research Sessions History Drawer state
  const [sessions, setSessions] = useState<IResearchSession[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Clear session confirmation modal
  const [showClearModal, setShowClearModal] = useState(false);

  // Summary modal state
  const [summaryData, setSummaryData] = useState<DocumentSummary | null>(null);
  const [summaryTitle, setSummaryTitle] = useState<string>('');
  const [summaryDocId, setSummaryDocId] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasAutoSelectedRef = useRef(false);

  // Fetch all sessions on mount
  const fetchSessions = useCallback(async () => {
    try {
      setLoadingSessions(true);
      const list = await researchService.getSessions();
      setSessions(list);
    } catch (err) {
      console.warn('[ResearchPage] Failed to fetch session history:', err);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Auto-select all ready docs once on initial mount if none selected
  useEffect(() => {
    if (!hasAutoSelectedRef.current && documents.length > 0) {
      if (selectedDocIds.length === 0) {
        const readyDocs = documents.filter((d) => d.status === 'ready');
        if (readyDocs.length > 0) {
          selectAllDocs(readyDocs.map((d) => d._id));
        }
      }
      hasAutoSelectedRef.current = true;
    }
  }, [documents, selectedDocIds.length, selectAllDocs]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // One-click Session Switching
  const handleSelectSession = async (targetSessionId: string) => {
    if (targetSessionId === sessionId) return;

    try {
      setIsLoading(true);
      setApiError(null);
      const { session, messages: loadedMessages } = await researchService.getSession(targetSessionId);

      setSessionId(session._id);
      setMessages(loadedMessages || []);

      // Restore session's selected documents
      if (session.selectedDocumentIds && session.selectedDocumentIds.length > 0) {
        setSelectedDocIds(session.selectedDocumentIds);
      }
    } catch (err: any) {
      setApiError(err.message || 'Failed to load research session.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start fresh research session
  const handleNewSession = () => {
    setSessionId(undefined);
    setMessages([]);
    setApiError(null);
  };

  // Delete session handler
  const handleDeleteSession = async (targetSessionId: string) => {
    try {
      await researchService.clearSession(targetSessionId);
      await fetchSessions();
      if (sessionId === targetSessionId) {
        setSessionId(undefined);
        setMessages([]);
      }
    } catch (err: any) {
      setApiError(err.message || 'Failed to delete research session.');
    }
  };

  // Send question via RAG streaming
  const handleAsk = async (question: string) => {
    if (!question.trim() || selectedDocIds.length === 0) return;

    setApiError(null);

    // Optimistically add user message
    const tempUserMsg: IChatMessage = {
      sessionId: sessionId || 'temp',
      role: 'user',
      content: question,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    let streamStarted = false;

    try {
      await researchService.askStream(
        {
          question,
          documentIds: selectedDocIds,
          sessionId,
        },
        {
          onStart: (data) => {
            streamStarted = true;
            if (data.sessionId) setSessionId(data.sessionId);
            setMessages((prev) => [
              ...prev,
              {
                sessionId: data.sessionId,
                role: 'assistant',
                content: '',
                citations: data.citations || [],
                createdAt: new Date().toISOString(),
              },
            ]);
          },
          onToken: (token) => {
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const last = prev[prev.length - 1];
              if (last.role !== 'assistant') return prev;
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + token },
              ];
            });
          },
          onDone: (data) => {
            setSessionId(data.sessionId);
            setMessages((prev) => {
              if (prev.length === 0) return prev;
              const last = prev[prev.length - 1];
              if (last.role !== 'assistant') {
                return [
                  ...prev,
                  {
                    sessionId: data.sessionId,
                    role: 'assistant',
                    content: data.answer,
                    citations: data.citations,
                    hasInsufficientEvidence: data.hasInsufficientEvidence,
                    degraded: data.degraded,
                    degradedReason: data.degradedReason,
                    createdAt: new Date().toISOString(),
                  },
                ];
              }
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  content: data.answer,
                  citations: data.citations,
                  hasInsufficientEvidence: data.hasInsufficientEvidence,
                  degraded: data.degraded,
                  degradedReason: data.degradedReason,
                },
              ];
            });
            // Refresh session list to include newly created or updated session
            fetchSessions();
          },
          onError: async (streamErr) => {
            console.warn('Streaming error, falling back to standard ask:', streamErr);
            if (!streamStarted) {
              const res = await researchService.ask({
                question,
                documentIds: selectedDocIds,
                sessionId,
              });
              setSessionId(res.sessionId);
              setMessages((prev) => [
                ...prev,
                {
                  sessionId: res.sessionId,
                  role: 'assistant',
                  content: res.answer,
                  citations: res.citations,
                  hasInsufficientEvidence: res.hasInsufficientEvidence,
                  degraded: res.degraded,
                  degradedReason: res.degradedReason,
                  createdAt: new Date().toISOString(),
                },
              ]);
              fetchSessions();
            } else {
              setApiError(streamErr.message || 'Stream error');
            }
          },
        }
      );
    } catch (err: any) {
      setApiError(err.message || 'Error communicating with research assistant.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConversation = async () => {
    if (sessionId) {
      try {
        await researchService.clearSession(sessionId);
        await fetchSessions();
      } catch (err) {
        console.warn('Could not clear remote session:', err);
      }
    }
    setSessionId(undefined);
    setMessages([]);
    setShowClearModal(false);
  };

  // Summarize action without fabricated generic fallbacks
  const handleQuickSummarize = async (docId: string, regenerate: boolean = false) => {
    const doc = documents.find((d) => d._id === docId);
    if (!doc) return;

    setSummaryTitle(doc.originalName);
    setSummaryDocId(docId);
    setSummaryError(null);

    if (regenerate) {
      setIsRegeneratingSummary(true);
    } else {
      setSummaryData(null);
      setLoadingSummary(true);
    }

    try {
      const res = await documentService.summarize(docId, regenerate);
      setSummaryData(res);
    } catch (err: any) {
      console.error('Summary synthesis failed:', err);
      // DO NOT fabricate fake generic text. Present honest error and retry action.
      setSummaryError(
        err.message || 'Failed to synthesize summary. Please try again or re-index the document.'
      );
    } finally {
      setLoadingSummary(false);
      setIsRegeneratingSummary(false);
    }
  };

  const handleSummarizeSelected = () => {
    if (selectedDocIds.length === 0) return;
    const doc = documents.find((d) => d._id === selectedDocIds[0]);
    if (doc) {
      handleQuickSummarize(doc._id);
    }
  };

  const handleOpenComparison = () => {
    navigate('/compare');
  };

  const readyDocuments = documents.filter((d) => d.status === 'ready');

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Column 1: Collapsible Session History Drawer */}
      <SessionHistoryDrawer
        sessions={sessions}
        activeSessionId={sessionId}
        isOpen={isHistoryOpen}
        onToggle={() => setIsHistoryOpen((prev) => !prev)}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isLoading={loadingSessions}
      />

      {/* Column 2: Document Context Selector */}
      <div className="w-80 shrink-0 h-full">
        <DocumentSelector
          documents={documents}
          selectedDocIds={selectedDocIds}
          onToggleSelect={toggleSelectDoc}
          onSelectAll={() => selectAllDocs()}
          onClearAll={clearSelectedDocs}
          onSummarize={(id) => handleQuickSummarize(id)}
        />
      </div>

      {/* Column 3: Central Research Conversation Panel */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* Workspace Action Toolbar */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              title={isHistoryOpen ? 'Collapse sessions' : 'Open sessions history'}
            >
              <History className="w-4 h-4 text-brand-600" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-slate-900 leading-none">
                  {sessionId
                    ? sessions.find((s) => s._id === sessionId)?.title || `Session #${sessionId.slice(-5)}`
                    : 'New Research Session'}
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                {selectedDocIds.length} paper{selectedDocIds.length === 1 ? '' : 's'} in active context
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedDocIds.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                icon={<GitCompare className="w-3.5 h-3.5 text-blue-600" />}
                onClick={handleOpenComparison}
                title="Open structured cross-document comparison"
              >
                Compare ({selectedDocIds.length})
              </Button>
            )}

            {selectedDocIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={<FileSearch className="w-3.5 h-3.5 text-brand-600" />}
                onClick={handleSummarizeSelected}
                title="Summarize first selected document"
              >
                Summarize
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              icon={<PlusCircle className="w-3.5 h-3.5 text-brand-600" />}
              onClick={handleNewSession}
              title="Start a fresh question session"
            >
              New Chat
            </Button>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-rose-600"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => setShowClearModal(true)}
                title="Clear current dialogue"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Central Chat Messages Scroll Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {readyDocuments.length === 0 ? (
            <div className="max-w-md mx-auto my-12 p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Ready Documents</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Please upload PDF research papers in the Documents page and wait for vector embedding to complete before asking questions.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/documents')}
                icon={<FileText className="w-3.5 h-3.5" />}
              >
                Go to Documents
              </Button>
            </div>
          ) : selectedDocIds.length === 0 ? (
            <div className="max-w-md mx-auto my-12 p-6 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <p className="text-sm font-semibold text-slate-700">
                Please select one or more research documents from the left panel.
              </p>
              <Button variant="primary" size="sm" onClick={() => selectAllDocs()}>
                Select All Ready Documents
              </Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="max-w-lg mx-auto my-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mx-auto shadow-sm shadow-brand-500/10">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Multi-Document RAG Query
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                  Ask natural language questions across your {selectedDocIds.length} selected research papers.
                  Answers are derived strictly from retrieved passages with exact document and page citations.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => <ChatMessage key={i} message={msg} />)
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-slate-200 shadow-2xs max-w-xs animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
              <span className="text-xs font-semibold text-slate-600">
                Retrieving passages & synthesizing evidence...
              </span>
            </div>
          )}

          {/* Error alert */}
          {apiError && (
            <div className="max-w-2xl mx-auto">
              <ErrorMessage message={apiError} onRetry={() => setApiError(null)} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-200">
          <ChatInput
            onSendMessage={handleAsk}
            isLoading={isLoading}
            disabled={selectedDocIds.length === 0}
            selectedCount={selectedDocIds.length}
          />
        </div>
      </div>

      {/* Clear Conversation Confirmation Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Clear Research Conversation"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to clear this conversation history?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setShowClearModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleClearConversation}>
              Clear Chat
            </Button>
          </div>
        </div>
      </Modal>

      {/* Document Summary Modal */}
      <Modal
        isOpen={!!summaryTitle}
        onClose={() => {
          setSummaryTitle('');
          setSummaryDocId(null);
          setSummaryError(null);
        }}
        title={`Summary: ${summaryTitle}`}
        maxWidth="xl"
      >
        {loadingSummary && <LoadingState message="Synthesizing structured document summary..." />}

        {summaryError && (
          <div className="p-4 space-y-3">
            <ErrorMessage message={summaryError} />
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => summaryDocId && handleQuickSummarize(summaryDocId, true)}
                isLoading={isRegeneratingSummary}
              >
                Retry Synthesis
              </Button>
            </div>
          </div>
        )}

        {summaryData && !loadingSummary && (
          <SummaryPanel
            summaryData={summaryData}
            documentTitle={summaryTitle}
            onRegenerate={() => summaryDocId && handleQuickSummarize(summaryDocId, true)}
            isRegenerating={isRegeneratingSummary}
          />
        )}
      </Modal>
    </div>
  );
};
