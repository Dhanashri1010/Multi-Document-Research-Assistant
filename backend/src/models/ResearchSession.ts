import mongoose, { Schema, Document as MongooseDoc, Types } from 'mongoose';

export interface IResearchSession extends MongooseDoc {
  userId?: Types.ObjectId;
  title: string;
  selectedDocumentIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ResearchSessionSchema = new Schema<IResearchSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    title: { type: String, required: true, default: 'New Research Session' },
    selectedDocumentIds: [{ type: Schema.Types.ObjectId, ref: 'Document', index: true }],
  },
  {
    timestamps: true,
  }
);

ResearchSessionSchema.index({ createdAt: -1 });

export const ResearchSessionModel = mongoose.model<IResearchSession>('ResearchSession', ResearchSessionSchema);
