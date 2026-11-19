import mongoose, { Schema, Document as MongooseDoc, Types } from 'mongoose';
import crypto from 'crypto';

export interface INlpCache {
  _id?: Types.ObjectId;
  userId?: Types.ObjectId;
  documentId: string;
  contentHash: string;
  task: string;
  paramsHash: string;
  promptVersion: string;
  model: string;
  result: any;
  createdAt?: Date;
}

const NlpCacheSchema = new Schema<INlpCache>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    documentId: {
      type: String,
      required: true,
      index: true,
    },
    contentHash: {
      type: String,
      required: true,
    },
    task: {
      type: String,
      required: true,
      index: true,
    },
    paramsHash: {
      type: String,
      required: true,
    },
    promptVersion: {
      type: String,
      required: true,
      default: 'v1.0',
    },
    model: {
      type: String,
      required: true,
      default: 'default',
    },
    result: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound unique index guaranteeing fast cache lookups and deduplication
NlpCacheSchema.index(
  {
    documentId: 1,
    contentHash: 1,
    task: 1,
    paramsHash: 1,
    promptVersion: 1,
    model: 1,
  },
  { unique: true }
);

export function computeHash(content: any): string {
  const str = typeof content === 'string' ? content : JSON.stringify(content || {});
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 32);
}

export const NlpCacheModel = mongoose.model<INlpCache>('NlpCache', NlpCacheSchema);

export class NlpCacheService {
  static async findOne(query: any): Promise<INlpCache | null> {
    if (mongoose.connection.readyState !== 1 && !(NlpCacheModel.findOne as any)?.mock) {
      return null;
    }
    return NlpCacheModel.findOne(query).catch(() => null);
  }

  static async findOneAndUpdate(filter: any, update: any, options: any = { upsert: true, new: true }): Promise<any> {
    if (mongoose.connection.readyState !== 1 && !(NlpCacheModel.findOneAndUpdate as any)?.mock) {
      return null;
    }
    return (await NlpCacheModel.findOneAndUpdate(filter, update, options).catch(() => null)) as any;
  }
}
