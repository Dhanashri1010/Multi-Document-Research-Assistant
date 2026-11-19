import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { Modal } from '../common/Modal.js';
import { DocumentUploader } from '../documents/DocumentUploader.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { apiClient } from '../../services/api.js';
import { Loader2 } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const { refreshDocuments } = useWorkspace();

  useEffect(() => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        setIsWakingUp(true);
      }
    }, 3000);

    apiClient
      .get('/health')
      .catch(() => {})
      .finally(() => {
        resolved = true;
        clearTimeout(timer);
        setIsWakingUp(false);
      });

    return () => clearTimeout(timer);
  }, []);

  const handleUploadComplete = async () => {
    setIsUploadOpen(false);
    await refreshDocuments();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {isWakingUp && (
          <div className="bg-amber-500 text-white px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 shadow-sm animate-pulse z-50">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>
              Server is waking up (Render free tier spin-up usually takes about a minute). Your research workspace will be ready in a moment...
            </span>
          </div>
        )}

        <Header onOpenUpload={() => setIsUploadOpen(true)} />

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Research Documents"
        maxWidth="lg"
      >
        <DocumentUploader onUploadComplete={handleUploadComplete} />
      </Modal>
    </div>
  );
};
