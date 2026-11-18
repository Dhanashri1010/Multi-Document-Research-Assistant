/**
 * Safe Migration Service for Legacy Documents & Sessions
 * Provides transactional / concurrency-safe assignment of unowned documents.
 */

import mongoose from 'mongoose';
import { DocumentModel } from '../../models/Document.js';
import { UserModel } from '../../models/User.js';
import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { ResearchSessionModel } from '../../models/ResearchSession.js';

export interface MigrationOptions {
  targetEmail: string;
  isExecute: boolean;
}

export interface MigrationSummary {
  success: boolean;
  dryRun: boolean;
  totalDocs: number;
  legacyDocsFound: number;
  totalSessions: number;
  legacySessionsFound: number;
  documentsClaimed: number;
  documentsSkippedDueToOwnershipChange: number;
  chunksClaimed: number;
  sessionsClaimed: number;
  sessionsSkippedDueToOwnershipChange: number;
  usedTransaction: boolean;
  rolledBack?: boolean;
  error?: string;
}

/**
 * Pure migration function suitable for programmatic invocation and unit testing.
 */
export async function migrateLegacyData(options: MigrationOptions): Promise<MigrationSummary> {
  const { targetEmail, isExecute } = options;

  const totalDocs = await DocumentModel.countDocuments();
  const legacyDocs = await DocumentModel.find({
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });

  const totalSessions = await ResearchSessionModel.countDocuments();
  const legacySessions = await ResearchSessionModel.find({
    $or: [{ userId: { $exists: false } }, { userId: null }],
  });

  const summary: MigrationSummary = {
    success: true,
    dryRun: !isExecute,
    totalDocs,
    legacyDocsFound: legacyDocs.length,
    totalSessions,
    legacySessionsFound: legacySessions.length,
    documentsClaimed: 0,
    documentsSkippedDueToOwnershipChange: 0,
    chunksClaimed: 0,
    sessionsClaimed: 0,
    sessionsSkippedDueToOwnershipChange: 0,
    usedTransaction: false,
  };

  if (!isExecute) {
    return summary;
  }

  // 1. Verify target user
  const targetUser = await UserModel.findOne({ email: targetEmail.toLowerCase().trim() });
  if (!targetUser) {
    throw new Error(`Target user with email "${targetEmail}" was not found in the database. Please register the user account first.`);
  }

  // 2. Determine transaction capability
  let clientSession: mongoose.ClientSession | null = null;
  let useTransaction = false;
  try {
    clientSession = await mongoose.startSession();
    clientSession.startTransaction();
    useTransaction = true;
    summary.usedTransaction = true;
  } catch (_sessionErr) {
    // Standalone instances without replica sets do not support multi-document transactions
    useTransaction = false;
    summary.usedTransaction = false;
    if (clientSession) {
      await clientSession.endSession();
      clientSession = null;
    }
  }

  const sessionOption = useTransaction && clientSession ? { session: clientSession } : {};
  const successfullyClaimedDocIds: mongoose.Types.ObjectId[] = [];
  const successfullyClaimedSessionIds: mongoose.Types.ObjectId[] = [];

  try {
    // 3. Concurrency-safe document update: Re-check unowned condition at instant of update
    for (const doc of legacyDocs) {
      const updateResult = await DocumentModel.updateOne(
        {
          _id: doc._id,
          $or: [{ userId: { $exists: false } }, { userId: null }],
        },
        { $set: { userId: targetUser._id } },
        sessionOption
      );

      if (updateResult.modifiedCount > 0) {
        successfullyClaimedDocIds.push(doc._id as mongoose.Types.ObjectId);
        summary.documentsClaimed++;
      } else {
        // Document was claimed or assigned between the initial find() and updateOne()
        summary.documentsSkippedDueToOwnershipChange++;
      }
    }

    // 4. Update associated chunks ONLY for documents that were successfully claimed
    if (successfullyClaimedDocIds.length > 0) {
      const chunkResult = await DocumentChunkModel.updateMany(
        {
          documentId: { $in: successfullyClaimedDocIds },
          $or: [{ userId: { $exists: false } }, { userId: null }],
        },
        { $set: { userId: targetUser._id } },
        sessionOption
      );
      summary.chunksClaimed = chunkResult.modifiedCount;
    }

    // 5. Concurrency-safe session update: Re-check unowned condition
    for (const sess of legacySessions) {
      const sessResult = await ResearchSessionModel.updateOne(
        {
          _id: sess._id,
          $or: [{ userId: { $exists: false } }, { userId: null }],
        },
        { $set: { userId: targetUser._id } },
        sessionOption
      );

      if (sessResult.modifiedCount > 0) {
        successfullyClaimedSessionIds.push(sess._id as mongoose.Types.ObjectId);
        summary.sessionsClaimed++;
      } else {
        summary.sessionsSkippedDueToOwnershipChange++;
      }
    }

    // 6. Commit transaction if active
    if (useTransaction && clientSession) {
      await clientSession.commitTransaction();
      await clientSession.endSession();
    }

    return summary;
  } catch (err: any) {
    summary.success = false;
    summary.error = err.message;

    // Rollback handling
    if (useTransaction && clientSession) {
      await clientSession.abortTransaction();
      await clientSession.endSession();
      summary.rolledBack = true;
    } else {
      // Explicit compensation rollback for standalone instances
      try {
        if (successfullyClaimedDocIds.length > 0) {
          await DocumentModel.updateMany(
            { _id: { $in: successfullyClaimedDocIds }, userId: targetUser._id },
            { $unset: { userId: 1 } }
          );
          await DocumentChunkModel.updateMany(
            { documentId: { $in: successfullyClaimedDocIds }, userId: targetUser._id },
            { $unset: { userId: 1 } }
          );
        }
        if (successfullyClaimedSessionIds.length > 0) {
          await ResearchSessionModel.updateMany(
            { _id: { $in: successfullyClaimedSessionIds }, userId: targetUser._id },
            { $unset: { userId: 1 } }
          );
        }
        summary.rolledBack = true;
      } catch (rollbackErr: any) {
        summary.error += ` | Rollback failed: ${rollbackErr.message}`;
      }
    }

    throw err;
  }
}

