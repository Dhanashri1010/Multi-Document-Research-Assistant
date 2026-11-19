export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'failed';
export type DocumentFileType = 'pdf' | 'docx' | 'doc' | 'txt';

export type DocumentCategory =
  | 'Research Paper'
  | 'Academic Article'
  | 'Technical Document'
  | 'Business Report'
  | 'Educational Material'
  | 'Legal Document'
  | 'User Manual'
  | 'General Document';

export interface FindingWithPage {
  finding: string;
  pageNumber?: number;
  heading?: string;
  paragraphNumber?: number;
}

export interface MetricWithPage {
  metric: string;
  value: string;
  context?: string;
  pageNumber?: number;
  heading?: string;
  paragraphNumber?: number;
}

export interface SummarySection {
  title: string;
  content?: string;
  items?: string[];
  pageNumber?: number;
  heading?: string;
  paragraphNumber?: number;
}

export interface DocumentSummary {
  category?: DocumentCategory | string;
  overview?: string;
  summary: string;
  sections?: SummarySection[];
  keyFindings: (string | FindingWithPage)[];
  importantData?: MetricWithPage[];
  methodology?: string;
  limitations?: string;
  conclusion?: string;
  legalDisclaimer?: string;
  generatedAt?: string;
  degraded?: boolean;
  degradedReason?: string;
  citations: {
    documentId: string;
    documentName: string;
    pageNumber?: number;
    heading?: string;
    section?: string;
    paragraphNumber?: number;
    fileType?: string;
    excerpt: string;
  }[];
}

export interface IDocument {
  _id: string;
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  fileType?: DocumentFileType;
  filePath: string;
  pageCount: number;
  chunkCount: number;
  embeddingModel?: string;
  embeddingDim?: number;
  status: DocumentStatus;
  collectionName?: string;
  category?: DocumentCategory | string;
  summaryData?: DocumentSummary;
  summaryText?: string;
  warning?: string;
  isLowTextDensity?: boolean;
  errorDetails?: string;
  embeddedChunkCount?: number;
  totalChunkCount?: number;
  processingMessage?: string;
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
