import React, { useState } from 'react';
import {
  History,
  PlusCircle,
  Trash2,
  ChevronLeft,
  MessageSquare,
  FileText,
  Clock,
} from 'lucide-react';
import { IResearchSession } from '../../types/research.js';
import { Button } from '../common/Button.js';
import { Modal } from '../common/Modal.js';

interface SessionHistoryDrawerProps {
  sessions: IResearchSession[];
  activeSessionId?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  isLoading?: boolean;
}

function formatSessionTimestamp(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 2) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export const SessionHistoryDrawer: React.FC<SessionHistoryDrawerProps> = ({
  sessions,
  activeSessionId,
  isOpen,
  onToggle,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isLoading = false,
}) => {
  const [sessionToDelete, setSessionToDelete] = useState<IResearchSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!sessionToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteSession(sessionToDelete._id);
      setSessionToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="shrink-0 flex flex-col items-center py-3 bg-white border-r border-slate-200 w-12 transition-all">
        <button
          onClick={onToggle}
          title="Open Research Sessions"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Expand research sessions history"
        >
          <History className="w-5 h-5" />
        </button>
        <span className="text-[10px] font-bold text-slate-400 [writing-mode:vertical-lr] rotate-180 mt-4 tracking-wider uppercase">
          History ({sessions.length})
        </span>
      </div>
    );
  }

  return (
    <>
      <aside className="w-72 shrink-0 h-full flex flex-col bg-white border-r border-slate-200 z-10 transition-all">
        {/* Drawer Header */}
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Sessions ({sessions.length})
            </h4>
          </div>
          <button
            onClick={onToggle}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors"
            title="Collapse sessions panel"
            aria-label="Collapse sessions panel"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Action: Start New Session */}
        <div className="p-3 border-b border-slate-100">
          <Button
            variant="outline"
            size="sm"
            fullWidth
            onClick={onNewSession}
            icon={<PlusCircle className="w-3.5 h-3.5 text-brand-600" />}
          >
            New Research Session
          </Button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoading && sessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">No previous sessions</p>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your research dialogues and document selections are automatically saved here.
              </p>
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess._id === activeSessionId;
              const docCount = sess.selectedDocumentIds?.length || 0;

              return (
                <div
                  key={sess._id}
                  className={`group relative p-2.5 rounded-xl text-left transition-all border cursor-pointer ${
                    isActive
                      ? 'bg-brand-50/70 border-brand-300 ring-1 ring-brand-200 text-slate-900'
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700'
                  }`}
                  onClick={() => onSelectSession(sess._id)}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <p
                      className="text-xs font-semibold truncate leading-snug flex-1"
                      title={sess.title}
                    >
                      {sess.title || 'Untitled Session'}
                    </p>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessionToDelete(sess);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-all shrink-0"
                      title="Delete session"
                      aria-label="Delete research session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatSessionTimestamp(sess.updatedAt || sess.createdAt)}
                    </span>

                    <span className="flex items-center gap-0.5 px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded border border-slate-200">
                      <FileText className="w-2.5 h-2.5" />
                      {docCount} {docCount === 1 ? 'doc' : 'docs'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!sessionToDelete}
        onClose={() => setSessionToDelete(null)}
        title="Delete Research Session"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete session &quot;<strong>{sessionToDelete?.title}</strong>&quot;?
            All associated conversation messages and citation logs will be removed.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSessionToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              isLoading={isDeleting}
            >
              Delete Session
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
