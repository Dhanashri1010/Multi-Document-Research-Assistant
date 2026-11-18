import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { migrateLegacyData } from '../services/migration/legacyMigrationService.js';
import { DocumentModel } from '../models/Document.js';
import { UserModel } from '../models/User.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { ResearchSessionModel } from '../models/ResearchSession.js';

describe('Migration Concurrency & Safety Tests', () => {
  const targetUserId = new mongoose.Types.ObjectId();
  const targetEmail = 'researcher@university.edu';
  const existingOtherUserId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    vi.restoreAllMocks();
    // In unit test mocks without live replica sets, mock startSession to reject so it tests standalone compensation rollback
    vi.spyOn(mongoose, 'startSession').mockRejectedValue(new Error('ReplicaSetNoPrimary: Not a replica set'));
  });

  it('runs in dry-run mode and performs zero database writes', async () => {
    vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(20 as any);
    vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([
      { _id: new mongoose.Types.ObjectId(), originalName: 'Doc1.pdf' },
      { _id: new mongoose.Types.ObjectId(), originalName: 'Doc2.pdf' },
    ] as any);
    vi.spyOn(ResearchSessionModel, 'countDocuments').mockResolvedValueOnce(5 as any);
    vi.spyOn(ResearchSessionModel, 'find').mockResolvedValueOnce([
      { _id: new mongoose.Types.ObjectId(), title: 'Session 1' },
    ] as any);

    const updateDocSpy = vi.spyOn(DocumentModel, 'updateOne');
    const updateChunkSpy = vi.spyOn(DocumentChunkModel, 'updateMany');

    const result = await migrateLegacyData({ targetEmail, isExecute: false });

    expect(result.dryRun).toBe(true);
    expect(result.legacyDocsFound).toBe(2);
    expect(result.legacySessionsFound).toBe(1);
    expect(result.documentsClaimed).toBe(0);
    expect(updateDocSpy).not.toHaveBeenCalled();
    expect(updateChunkSpy).not.toHaveBeenCalled();
  });

  it('fails safely if the target user is not registered in the database', async () => {
    vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(1 as any);
    vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([
      { _id: new mongoose.Types.ObjectId() },
    ] as any);
    vi.spyOn(ResearchSessionModel, 'countDocuments').mockResolvedValueOnce(0 as any);
    vi.spyOn(ResearchSessionModel, 'find').mockResolvedValueOnce([] as any);

    vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce(null);

    await expect(
      migrateLegacyData({ targetEmail: 'nonexistent@example.com', isExecute: true })
    ).rejects.toThrow(/Target user with email .* was not found/i);
  });

  it('skips document and prevents overwrite if ownership changes between initial read and update', async () => {
    const doc1Id = new mongoose.Types.ObjectId();
    const doc2Id = new mongoose.Types.ObjectId();

    vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(2 as any);
    // Initial read finds 2 legacy docs
    vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([
      { _id: doc1Id, originalName: 'Paper 1.pdf' },
      { _id: doc2Id, originalName: 'Paper 2.pdf' },
    ] as any);
    vi.spyOn(ResearchSessionModel, 'countDocuments').mockResolvedValueOnce(0 as any);
    vi.spyOn(ResearchSessionModel, 'find').mockResolvedValueOnce([] as any);

    // Target user found
    vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce({
      _id: targetUserId,
      name: 'Dr. Jane',
      email: targetEmail,
    } as any);

    // Simulate Document 1 being claimed by someone else concurrently:
    // When updateOne runs for doc1Id with filter { userId: null }, modifiedCount is 0!
    // For doc2Id, it succeeds: modifiedCount is 1.
    const updateOneSpy = vi
      .spyOn(DocumentModel, 'updateOne')
      .mockResolvedValueOnce({ modifiedCount: 0 } as any) // Doc 1 skipped!
      .mockResolvedValueOnce({ modifiedCount: 1 } as any); // Doc 2 claimed!

    const chunkUpdateSpy = vi
      .spyOn(DocumentChunkModel, 'updateMany')
      .mockResolvedValueOnce({ modifiedCount: 15 } as any);

    const result = await migrateLegacyData({ targetEmail, isExecute: true });

    expect(result.documentsClaimed).toBe(1);
    expect(result.documentsSkippedDueToOwnershipChange).toBe(1);

    // Verify filter strictly required userId to be null/missing
    expect(updateOneSpy).toHaveBeenCalledWith(
      {
        _id: doc1Id,
        $or: [{ userId: { $exists: false } }, { userId: null }],
      },
      { $set: { userId: targetUserId } },
      expect.anything()
    );

    // Verify chunk update only targeted doc2Id (NOT doc1Id)
    expect(chunkUpdateSpy).toHaveBeenCalledWith(
      {
        documentId: { $in: [doc2Id] },
        $or: [{ userId: { $exists: false } }, { userId: null }],
      },
      { $set: { userId: targetUserId } },
      expect.anything()
    );
  });

  it('triggers compensation rollback when failure occurs on standalone instances', async () => {
    const docId = new mongoose.Types.ObjectId();

    vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(1 as any);
    vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([{ _id: docId }] as any);
    vi.spyOn(ResearchSessionModel, 'countDocuments').mockResolvedValueOnce(0 as any);
    vi.spyOn(ResearchSessionModel, 'find').mockResolvedValueOnce([] as any);

    vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce({
      _id: targetUserId,
      email: targetEmail,
    } as any);

    // Document update succeeds
    vi.spyOn(DocumentModel, 'updateOne').mockResolvedValueOnce({ modifiedCount: 1 } as any);

    // Chunk update fails with database error, and its rollback succeeds
    const chunkRollbackSpy = vi
      .spyOn(DocumentChunkModel, 'updateMany')
      .mockRejectedValueOnce(new Error('Disk write error during chunk update'))
      .mockResolvedValueOnce({ modifiedCount: 0 } as any);

    const docRollbackSpy = vi
      .spyOn(DocumentModel, 'updateMany')
      .mockResolvedValueOnce({ modifiedCount: 1 } as any);

    await expect(
      migrateLegacyData({ targetEmail, isExecute: true })
    ).rejects.toThrow(/Disk write error during chunk update/);

    // Verify compensation rollback was executed on the claimed document and chunks
    expect(docRollbackSpy).toHaveBeenCalledWith(
      { _id: { $in: [docId] }, userId: targetUserId },
      { $unset: { userId: 1 } }
    );
    expect(chunkRollbackSpy).toHaveBeenCalledTimes(2);
  });

  it('uses MongoDB transaction and calls commitTransaction on replica-set instances', async () => {
    const docId = new mongoose.Types.ObjectId();
    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      abortTransaction: vi.fn().mockResolvedValue(undefined),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(mongoose, 'startSession').mockResolvedValueOnce(mockSession as any);

    vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(1 as any);
    vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([{ _id: docId }] as any);
    vi.spyOn(ResearchSessionModel, 'countDocuments').mockResolvedValueOnce(0 as any);
    vi.spyOn(ResearchSessionModel, 'find').mockResolvedValueOnce([] as any);

    vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce({
      _id: targetUserId,
      email: targetEmail,
    } as any);

    vi.spyOn(DocumentModel, 'updateOne').mockResolvedValueOnce({ modifiedCount: 1 } as any);
    vi.spyOn(DocumentChunkModel, 'updateMany').mockResolvedValueOnce({ modifiedCount: 5 } as any);

    const result = await migrateLegacyData({ targetEmail, isExecute: true });

    expect(result.usedTransaction).toBe(true);
    expect(mockSession.startTransaction).toHaveBeenCalled();
    expect(mockSession.commitTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
    expect(mockSession.abortTransaction).not.toHaveBeenCalled();
  });

  it('calls abortTransaction when an error occurs in the transaction path', async () => {
    const docId = new mongoose.Types.ObjectId();
    const mockSession = {
      startTransaction: vi.fn(),
      commitTransaction: vi.fn().mockResolvedValue(undefined),
      abortTransaction: vi.fn().mockResolvedValue(undefined),
      endSession: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(mongoose, 'startSession').mockResolvedValueOnce(mockSession as any);

    vi.spyOn(DocumentModel, 'countDocuments').mockResolvedValueOnce(1 as any);
    vi.spyOn(DocumentModel, 'find').mockResolvedValueOnce([{ _id: docId }] as any);
    vi.spyOn(ResearchSessionModel, 'countDocuments').mockResolvedValueOnce(0 as any);
    vi.spyOn(ResearchSessionModel, 'find').mockResolvedValueOnce([] as any);

    vi.spyOn(UserModel, 'findOne').mockResolvedValueOnce({
      _id: targetUserId,
      email: targetEmail,
    } as any);

    vi.spyOn(DocumentModel, 'updateOne').mockResolvedValueOnce({ modifiedCount: 1 } as any);
    vi.spyOn(DocumentChunkModel, 'updateMany').mockRejectedValueOnce(
      new Error('Network error during chunk update')
    );

    await expect(
      migrateLegacyData({ targetEmail, isExecute: true })
    ).rejects.toThrow(/Network error during chunk update/);

    expect(mockSession.abortTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });
});
