export interface ICitation {
  documentId: string;
  documentName: string;
  pageNumber: number;
  pageStart?: number;
  pageEnd?: number;
  excerpt: string;
  score?: number;
}

export interface IChatMessage {
  _id?: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations: ICitation[];
  hasInsufficientEvidence?: boolean;
  degraded?: boolean;
  degradedReason?: string;
  createdAt: string;
}

export interface IResearchSession {
  _id: string;
  title: string;
  selectedDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ComparisonDimension {
  dimension: string;
  values: {
    documentId: string;
    documentName: string;
    finding: string;
    pageNumber?: number;
  }[];
}

export interface ComparisonResult {
  documents: {
    id: string;
    name: string;
    pageCount: number;
  }[];
  focusTopic?: string;
  matrix: ComparisonDimension[];
  similarities: string[];
  differences: string[];
  keyFindings: string[];
  limitations: string[];
  citations: ICitation[];
  degraded?: boolean;
  degradedReason?: string;
}
