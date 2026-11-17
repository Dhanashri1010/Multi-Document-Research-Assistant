import mongoose, { Schema, Document as MongooseDoc, Types } from 'mongoose';

export interface ICitation {
  documentId: Types.ObjectId;
  documentName: string;
  pageNumber?: number;
  heading?: string;
  section?: string;
  paragraphNumber?: number;
  fileType?: string;
  excerpt: string;
  score?: number;
  verified?: boolean;
  supportScore?: number;
}

export interface IChatMessage extends MongooseDoc {
  sessionId: Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  citations: ICitation[];
  hasInsufficientEvidence?: boolean;
  degraded?: boolean;
  degradedReason?: string;
  createdAt: Date;
}

const CitationSchema = new Schema<ICitation>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    documentName: { type: String, required: true },
    pageNumber: { type: Number, required: false },
    heading: { type: String },
    section: { type: String },
    paragraphNumber: { type: Number },
    fileType: { type: String },
    excerpt: { type: String, required: true },
    score: { type: Number },
    verified: { type: Boolean, default: true },
    supportScore: { type: Number },
  },
  { _id: false }
);

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'ResearchSession', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    citations: { type: [CitationSchema], default: [] },
    hasInsufficientEvidence: { type: Boolean, default: false },
    degraded: { type: Boolean, default: false },
    degradedReason: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
ChatMessageSchema.index({ sessionId: 1, createdAt: -1 });

export const ChatMessageModel = mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);
