import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { IDocument } from '../types/document.js';
import { documentService } from '../services/documentService.js';

interface WorkspaceContextType {
  documents: IDocument[];
  loadingDocuments: boolean;
  selectedDocIds: string[];
  setSelectedDocIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectDoc: (id: string) => void;
  selectAllDocs: (ids?: string[]) => void;
  clearSelectedDocs: () => void;
  refreshDocuments: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<IDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState<boolean>(true);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  const refreshDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      const docs = await documentService.list();
      setDocuments(docs);
    } catch (err) {
      console.error('[WorkspaceContext] Failed to load documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  const toggleSelectDoc = useCallback((id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((dId) => dId !== id) : [...prev, id]
    );
  }, []);

  const selectAllDocs = useCallback((ids?: string[]) => {
    if (ids) {
      setSelectedDocIds(ids);
    } else {
      const readyDocIds = documents.filter((d) => d.status === 'ready').map((d) => d._id);
      setSelectedDocIds(readyDocIds);
    }
  }, [documents]);

  const clearSelectedDocs = useCallback(() => {
    setSelectedDocIds([]);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        documents,
        loadingDocuments,
        selectedDocIds,
        setSelectedDocIds,
        toggleSelectDoc,
        selectAllDocs,
        clearSelectedDocs,
        refreshDocuments,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
