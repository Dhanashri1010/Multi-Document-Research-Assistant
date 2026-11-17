import mongoose, { Schema, Document as MongooseDoc, Types } from 'mongoose';

export interface IDocumentChunk extends MongooseDoc {
  documentId: Types.ObjectId;
  chunkIndex: number;
  text: string;
  embeddingText?: string;
  section?: string;
  heading?: string;
  paragraphNumber?: number;
  paragraphStart?: number;
  paragraphEnd?: number;
  fileType?: string;
  pageNumber?: number; // Kept as pageStart for backward compatibility
  pageStart?: number;
  pageEnd?: number;
  tokenCount: number;
  embedding: number[];
  embeddingModel?: string;
  embeddingDim?: number;
  createdAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    embeddingText: {
      type: String,
    },
    section: {
      type: String,
      default: 'Content',
      index: true,
    },
    heading: {
      type: String,
    },
    paragraphNumber: {
      type: Number,
    },
    paragraphStart: {
      type: Number,
    },
    paragraphEnd: {
      type: Number,
    },
    fileType: {
      type: String,
    },
    pageNumber: {
      type: Number,
      required: false,
      index: true,
    },
    pageStart: {
      type: Number,
      required: false,
      index: true,
    },
    pageEnd: {
      type: Number,
      required: false,
      index: true,
    },
    tokenCount: {
      type: Number,
      required: true,
      default: 0,
    },
    embedding: {
      type: [Number],
      required: true,
      select: true,
    },
    embeddingModel: {
      type: String,
    },
    embeddingDim: {
      type: Number,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for fast ordered chunk retrieval and document lookups
DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });

export const DocumentChunkModel = mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
