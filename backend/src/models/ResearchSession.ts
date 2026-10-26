import mongoose, { Schema, Document as MongooseDoc, Types } from 'mongoose';

export interface IResearchSession extends MongooseDoc {
  title: string;
  selectedDocumentIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ResearchSessionSchema = new Schema<IResearchSession>(
  {
    title: { type: String, required: true, default: 'New Research Session' },
    selectedDocumentIds: [{ type: Schema.Types.ObjectId, ref: 'Document' }],
  },
  {
    timestamps: true,
  }
);

export const ResearchSessionModel = mongoose.model<IResearchSession>('ResearchSession', ResearchSessionSchema);
