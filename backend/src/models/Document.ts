import mongoose, { Schema, Document as MongooseDoc } from 'mongoose';

export type DocumentStatus = 'uploaded' | 'processing' | 'ready' | 'failed';

export interface IDocument extends MongooseDoc {
  filename: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  pageCount: number;
  chunkCount: number;
  embeddingModel?: string;
  embeddingDim?: number;
  fileHash?: string;
  title?: string;
  authors?: string[];
  year?: number;
  abstract?: string;
  status: DocumentStatus;
  errorDetails?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true, default: 'application/pdf' },
    filePath: { type: String, required: true },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    embeddingModel: { type: String },
    embeddingDim: { type: Number },
    fileHash: { type: String, index: true },
    title: { type: String },
    authors: { type: [String], default: [] },
    year: { type: Number },
    abstract: { type: String },
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'ready', 'failed'],
      default: 'uploaded',
      index: true,
    },
    errorDetails: { type: String },
  },
  {
    timestamps: true,
  }
);

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
