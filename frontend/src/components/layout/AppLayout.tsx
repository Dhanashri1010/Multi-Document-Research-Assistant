import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { Modal } from '../common/Modal.js';
import { DocumentUploader } from '../documents/DocumentUploader.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';

export const AppLayout: React.FC = () => {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const { refreshDocuments } = useWorkspace();

  const handleUploadComplete = async () => {
    setIsUploadOpen(false);
    await refreshDocuments();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
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
