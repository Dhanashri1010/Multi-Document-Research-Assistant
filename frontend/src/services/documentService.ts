import { apiClient } from './api.js';
import { IDocument, WorkspaceStats, DocumentSummary } from '../types/document.js';

export const documentService = {
  async upload(files: File[], onProgress?: (percent: number) => void): Promise<IDocument[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await apiClient.post<{ success: boolean; documents: IDocument[] }>(
      '/documents/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total && onProgress) {
            const percent = Math.round((event.loaded * 100) / event.total);
            onProgress(percent);
          }
        },
      }
    );
    return response.data.documents;
  },

  async list(): Promise<IDocument[]> {
    const response = await apiClient.get<{ success: boolean; documents: IDocument[] }>('/documents');
    return response.data.documents;
  },

  async getStats(): Promise<{ stats: WorkspaceStats; recentDocuments: IDocument[] }> {
    const response = await apiClient.get<{
      success: boolean;
      stats: WorkspaceStats;
      recentDocuments: IDocument[];
    }>('/documents/stats');
    return {
      stats: response.data.stats,
      recentDocuments: response.data.recentDocuments,
    };
  },

  async getById(id: string): Promise<IDocument> {
    const response = await apiClient.get<{ success: boolean; document: IDocument }>(`/documents/${id}`);
    return response.data.document;
  },

  async getStatus(id: string): Promise<{
    status: IDocument['status'];
    errorDetails?: string;
    pageCount: number;
    chunkCount: number;
  }> {
    const response = await apiClient.get<{
      success: boolean;
      status: IDocument['status'];
      errorDetails?: string;
      pageCount: number;
      chunkCount: number;
    }>(`/documents/${id}/status`);
    return response.data;
  },

  async reprocess(id: string): Promise<IDocument> {
    const response = await apiClient.post<{ success: boolean; document: IDocument }>(
      `/documents/${id}/reprocess`
    );
    return response.data.document;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/documents/${id}`);
  },

  async summarize(id: string): Promise<DocumentSummary> {
    const response = await apiClient.post<DocumentSummary & { success: boolean }>(
      `/documents/${id}/summarize`,
      {},
      { timeout: 15000 }
    );
    return response.data;
  },

  async reindexAll(): Promise<{ total: number; succeeded: number; failed: number }> {
    const response = await apiClient.post<{
      success: boolean;
      total: number;
      succeeded: number;
      failed: number;
    }>('/documents/reindex-all');
    return response.data;
  },
};
