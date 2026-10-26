export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface IDocument {
  _id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  pageCount: number;
  chunkCount: number;
  embeddingModel?: string;
  embeddingDim?: number;
  status: DocumentStatus;
  errorDetails?: string;
  title?: string;
  authors?: string[];
  abstract?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceStats {
  totalDocuments: number;
  readyDocuments: number;
  processingDocuments: number;
  failedDocuments: number;
}

export interface DocumentSummary {
  summary: string;
  keyFindings: string[];
  methodology: string;
  limitations: string;
  degraded?: boolean;
  degradedReason?: string;
  citations: {
    documentId: string;
    documentName: string;
    pageNumber: number;
    excerpt: string;
  }[];
}
