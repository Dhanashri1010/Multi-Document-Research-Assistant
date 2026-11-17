import fs from 'fs';
import path from 'path';
import mongoose, { Types } from 'mongoose';
import { DocumentModel } from '../../models/Document.js';
import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { ResearchSessionModel } from '../../models/ResearchSession.js';
import { extractPdf, extractTxt } from './extractor.js';
import { chunkPages, estimateTokenCount } from './chunker.js';
import { getEmbeddingProvider } from '../ai/embeddingService.js';
import { invalidateVectorCache } from '../ai/vectorStore.js';
import { detectDocumentCategory } from '../ai/documentSummaryService.js';
import { config } from '../../config/env.js';

/**
 * Serial FIFO queue runner ensuring concurrency 1 for heavy extraction and embedding tasks.
 */
class IngestionQueue {
  private queue: Array<() => Promise<void>> = [];
  private isRunning = false;

  enqueue(task: () => Promise<void>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          await task();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      this.processNext();
    });
  }

  private async processNext(): Promise<void> {
    if (this.isRunning || this.queue.length === 0) return;
    this.isRunning = true;
    const nextTask = this.queue.shift();
    if (nextTask) {
      try {
        await nextTask();
      } catch (err) {
        console.error('[IngestionQueue] Task processing error:', err);
      } finally {
        this.isRunning = false;
        this.processNext();
      }
    } else {
      this.isRunning = false;
    }
  }
}

const ingestionQueue = new IngestionQueue();

export class IngestionService {
  /**
   * Enqueues a document for serial background ingestion.
   */
  static queueDocument(documentId: string | Types.ObjectId): Promise<void> {
    return ingestionQueue.enqueue(() => this.processDocument(documentId));
  }

  /**
   * Processes or safely reprocesses an uploaded document:
   * 1. Extracts per-page text (PDF or TXT) & page 1 metadata (title, authors, abstract)
   * 2. Cleans text & handles empty/scanned edge cases
   * 3. Chunks text cross-page with section headings
   * 4. Generates and validates dense embeddings BEFORE replacing existing chunks
   * 5. Atomically or safely replaces chunks using replica-set transactions or staged replacement
   * 6. Preserves previously working chunks, embeddings, and summary if reprocessing fails
   */
  static async processDocument(documentId: string | Types.ObjectId): Promise<void> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      console.error(`[Ingestion] Document ${documentId} not found.`);
      return;
    }

    // Preserve previous working state for rollback on reprocessing failure
    const previousStatus = doc.status;
    const isReprocessing = previousStatus === 'ready';
    const previousSummaryData = doc.summaryData;
    const previousSummaryText = doc.summaryText;
    const previousCategory = doc.category;
    const previousChunkCount = doc.chunkCount;

    let stagedChunkIds: Types.ObjectId[] = [];
    let transactionCommitted = false;

    try {
      doc.status = 'processing';
      doc.errorDetails = undefined;
      await doc.save();

      console.log(`[Ingestion] Starting ingestion for: "${doc.originalName}" (${doc._id}) [reprocessing=${isReprocessing}]`);

      // 1. Text Extraction (Route by extension / mime type)
      const ext = path.extname(doc.filePath).toLowerCase();
      const isTxt = ext === '.txt' || doc.mimeType === 'text/plain';

      const extraction = isTxt
        ? await extractTxt(doc.filePath)
        : await extractPdf(doc.filePath);

      if (!extraction.pages || extraction.pages.length === 0 || !extraction.fullText.trim()) {
        throw new Error(
          'No readable text could be extracted from this document. It may be a scanned image or protected PDF.'
        );
      }

      console.log(`[Ingestion] Extracted ${extraction.totalPages} pages from "${doc.originalName}"`);

      // Attach page 1 metadata if extracted
      if (extraction.metadata?.title) {
        doc.title = extraction.metadata.title;
      }
      if (extraction.metadata?.authors && extraction.metadata.authors.length > 0) {
        doc.authors = extraction.metadata.authors;
      }
      if (extraction.metadata?.year) {
        doc.year = extraction.metadata.year;
      }
      if (extraction.metadata?.abstract) {
        doc.abstract = extraction.metadata.abstract;
      }

      // Detect document category
      const detectedCategory = detectDocumentCategory(
        extraction.pages.slice(0, 3).map((p) => p.text).join(' '),
        doc.title || doc.originalName,
        doc.abstract
      );
      doc.category = detectedCategory;

      // 2. Cross-page Chunking with section detection
      const embeddingProvider = getEmbeddingProvider();
      const rawChunks = chunkPages(extraction.pages, {
        targetTokens: config.chunkTargetTokens,
        overlapTokens: config.chunkOverlapTokens,
        tokenCounter: estimateTokenCount,
        docTitle: doc.title || doc.originalName,
      });

      if (rawChunks.length === 0) {
        throw new Error('Document contained text but generated zero chunks after filtering.');
      }

      // Add dedicated Front-Matter chunk (title, authors, affiliations, year, abstract) at chunkIndex 0
      const frontMatterParts: string[] = [];
      const paperTitle = doc.title || extraction.metadata?.title || doc.originalName.replace(/\.pdf$/i, '');
      frontMatterParts.push(`Paper Title: ${paperTitle}`);
      if (doc.authors && doc.authors.length > 0) {
        frontMatterParts.push(`Authors: ${doc.authors.join(', ')}`);
      }
      if (extraction.metadata?.affiliations && extraction.metadata.affiliations.length > 0) {
        frontMatterParts.push(`Affiliations: ${extraction.metadata.affiliations.join('; ')}`);
      }
      if (doc.year) {
        frontMatterParts.push(`Publication Year: ${doc.year}`);
      }
      if (doc.abstract) {
        frontMatterParts.push(`Abstract: ${doc.abstract}`);
      }
      if (extraction.metadata?.frontMatterText) {
        frontMatterParts.push(`Front Matter Overview:\n${extraction.metadata.frontMatterText}`);
      }

      const frontMatterText = frontMatterParts.join('\n\n').trim();
      const frontMatterChunk = {
        chunkIndex: 0,
        text: frontMatterText,
        embeddingText: `Document: ${paperTitle} | Section: Front Matter, Authors & Abstract\n${frontMatterText}`,
        section: 'Front Matter, Authors & Abstract',
        pageStart: 1,
        pageEnd: 1,
        tokenCount: estimateTokenCount(frontMatterText),
      };

      const chunks = [
        frontMatterChunk,
        ...rawChunks.map((c, i) => ({ ...c, chunkIndex: i + 1 })),
      ];

      // Validate all chunk contents before embedding
      for (const chunk of chunks) {
        if (!chunk.text || typeof chunk.text !== 'string' || chunk.text.trim().length === 0) {
          throw new Error(`Invalid empty text encountered in chunk at index ${chunk.chunkIndex}`);
        }
      }

      console.log(`[Ingestion] Generated ${chunks.length} chunks (including Front-Matter chunk). Generating embeddings...`);

      // 3. Dense Embeddings Generation
      const chunkTexts = chunks.map((c) => c.embeddingText || c.text);
      const embeddings = await embeddingProvider.embedDocuments(chunkTexts);
      const modelName = embeddingProvider.getModelName();
      const dim = embeddingProvider.getDimension();

      // Validate embeddings before proceeding to database mutation
      if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding generation mismatch: expected ${chunks.length} vectors, got ${embeddings?.length || 0}`
        );
      }

      for (let i = 0; i < embeddings.length; i++) {
        const emb = embeddings[i];
        if (!Array.isArray(emb) || emb.length !== dim) {
          throw new Error(`Invalid embedding vector dimension at chunk ${i}: expected ${dim}, got ${emb?.length || 0}`);
        }
      }

      // 4. Batch Prepare Chunk Documents
      const chunkDocs = chunks.map((c, index) => ({
        documentId: doc._id,
        chunkIndex: c.chunkIndex,
        text: c.text,
        embeddingText: c.embeddingText,
        section: c.section || 'Content',
        pageNumber: c.pageStart,
        pageStart: c.pageStart,
        pageEnd: c.pageEnd,
        tokenCount: c.tokenCount,
        embedding: embeddings[index],
        embeddingModel: modelName,
        embeddingDim: dim,
      }));

      // 5. Atomic or Safe Staged Replacement Strategy
      let session: mongoose.ClientSession | null = null;
      try {
        if (mongoose.connection.readyState === 1) {
          const testSession = await mongoose.startSession();
          const topologyType = (mongoose.connection as any)?.client?.topology?.description?.type;
          if (topologyType && topologyType !== 'Single') {
            session = testSession;
            session.startTransaction();
          } else {
            await testSession.endSession();
          }
        }
      } catch {
        session = null;
      }

      if (session) {
        // Replica Set / Mongos: Full ACID Transaction
        try {
          await DocumentChunkModel.deleteMany({ documentId: doc._id }).session(session);
          const inserted = await DocumentChunkModel.insertMany(chunkDocs, { session });
          stagedChunkIds = inserted.map((c) => c._id);

          doc.status = 'ready';
          doc.pageCount = extraction.totalPages;
          doc.chunkCount = chunks.length;
          doc.embeddingModel = modelName;
          doc.embeddingDim = dim;
          doc.warning = extraction.warning;
          doc.isLowTextDensity = extraction.isLowTextDensity;
          doc.errorDetails = undefined;
          doc.summaryData = undefined;
          doc.summaryText = undefined;
          await doc.save({ session });

          await session.commitTransaction();
          transactionCommitted = true;
        } catch (txErr) {
          await session.abortTransaction().catch(() => {});
          throw txErr;
        } finally {
          await session.endSession().catch(() => {});
        }
      } else {
        // Standalone MongoDB (Single-node): Safe Staged Replacement
        // 1. Insert new chunks FIRST
        const inserted = await DocumentChunkModel.insertMany(chunkDocs);
        stagedChunkIds = inserted.map((c) => c._id);

        // 2. Remove older chunks belonging to this document that are not part of the new set
        await DocumentChunkModel.deleteMany({
          documentId: doc._id,
          _id: { $nin: stagedChunkIds },
        });

        // 3. Commit ready status and update metadata
        doc.status = 'ready';
        doc.pageCount = extraction.totalPages;
        doc.chunkCount = chunks.length;
        doc.embeddingModel = modelName;
        doc.embeddingDim = dim;
        doc.warning = extraction.warning;
        doc.isLowTextDensity = extraction.isLowTextDensity;
        doc.errorDetails = undefined;
        doc.summaryData = undefined;
        doc.summaryText = undefined;
        await doc.save();
      }

      // Invalidate vector cache so fresh embeddings are loaded
      invalidateVectorCache(doc._id.toString());

      if (extraction.warning) {
        console.warn(`[Ingestion] Warning for "${doc.originalName}": ${extraction.warning}`);
      }

      console.log(`[Ingestion] Successfully indexed "${doc.originalName}" with ${chunks.length} chunks (${modelName}, dim: ${dim}).`);
    } catch (err: any) {
      console.error(`[Ingestion] Error processing document "${doc.originalName}":`, err);

      // Clean up any staged new chunks if failure occurred before full commit
      if (stagedChunkIds.length > 0 && !transactionCommitted) {
        try {
          await DocumentChunkModel.deleteMany({ _id: { $in: stagedChunkIds } });
        } catch (cleanupErr) {
          console.error('[Ingestion] Failed to clean up staged chunks:', cleanupErr);
        }
      }

      // If document was previously working ('ready'), preserve existing chunks, embeddings and summary
      if (isReprocessing) {
        const remainingChunks = await DocumentChunkModel.countDocuments({ documentId: doc._id });
        if (remainingChunks > 0) {
          doc.status = 'ready';
          doc.chunkCount = previousChunkCount || remainingChunks;
          doc.summaryData = previousSummaryData;
          doc.summaryText = previousSummaryText;
          doc.category = previousCategory;
          doc.errorDetails = `Reprocessing encountered an error (${err?.message || 'unknown'}). Previously indexed version with ${remainingChunks} chunks was safely preserved.`;
          await doc.save();
          console.log(`[Ingestion] Safely preserved working chunks and summary for "${doc.originalName}" after reprocessing failure.`);
          return;
        }
      }

      // If initial ingestion of a new document failed or no prior chunks exist
      doc.status = 'failed';
      doc.errorDetails = err?.message || 'Unknown processing error';
      await doc.save();
    }
  }

  /**
   * Re-indexes all documents in the database using the currently active embedding model.
   */
  static async reindexAllDocuments(): Promise<{ total: number; succeeded: number; failed: number }> {
    const docs = await DocumentModel.find({ status: { $in: ['ready', 'failed', 'uploaded'] } });
    let succeeded = 0;
    let failed = 0;

    for (const doc of docs) {
      try {
        await this.processDocument(doc._id);
        const updated = await DocumentModel.findById(doc._id);
        if (updated?.status === 'ready') {
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    invalidateVectorCache();
    return { total: docs.length, succeeded, failed };
  }

  /**
   * Safely deletes a document and performs cascade cleanup:
   * 1. Removes document ID from all ResearchSessionModel.selectedDocumentIds
   * 2. Deletes associated chunk records and embeddings
   * 3. Invalidates cached vectors
   * 4. Deletes physical file from disk
   * 5. Deletes document record from database
   * Handles partial failures safely without leaking orphaned records or altering unrelated documents.
   */
  static async deleteDocument(documentId: string | Types.ObjectId): Promise<boolean> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) return false;

    const docObjectId = doc._id;
    const docIdStr = doc._id.toString();

    // 1. Cascade cleanup from research sessions
    try {
      await ResearchSessionModel.updateMany(
        { selectedDocumentIds: docObjectId },
        { $pull: { selectedDocumentIds: docObjectId } }
      );
    } catch (sessionErr) {
      console.error(`[Ingestion] Failed to remove document ${docIdStr} from research sessions:`, sessionErr);
    }

    // 2. Cascade cleanup of chunks & embeddings
    try {
      await DocumentChunkModel.deleteMany({ documentId: docObjectId });
    } catch (chunkErr) {
      console.error(`[Ingestion] Failed to delete chunks for document ${docIdStr}:`, chunkErr);
    }

    // 3. Invalidate vector store cache
    try {
      invalidateVectorCache(docIdStr);
    } catch (cacheErr) {
      console.warn(`[Ingestion] Failed to invalidate vector cache for ${docIdStr}:`, cacheErr);
    }

    // 4. Delete physical file from disk safely
    try {
      if (doc.filePath && fs.existsSync(doc.filePath)) {
        await fs.promises.unlink(doc.filePath);
      }
    } catch (fsErr) {
      console.warn(`[Ingestion] Could not delete physical file ${doc.filePath}:`, fsErr);
    }

    // 5. Delete document record
    await DocumentModel.findByIdAndDelete(docObjectId);

    return true;
  }

  /**
   * Database integrity check & maintenance utility:
   * - Detects and cleans up orphaned chunks whose documentId no longer exists
   * - Detects and cleans up invalid document references in ResearchSessionModel
   * - Preserves all valid records and uploaded files
   */
  static async verifyAndCleanDatabaseIntegrity(): Promise<{
    orphanedChunksRemoved: number;
    cleanedSessionReferences: number;
  }> {
    const validDocs = await DocumentModel.find().select('_id').lean();
    const validDocIds = new Set(validDocs.map((d) => d._id.toString()));

    // 1. Clean orphaned chunks
    const allChunkDocIds = await DocumentChunkModel.distinct('documentId');
    const orphanedDocIds = allChunkDocIds.filter((id) => !validDocIds.has(id.toString()));

    let orphanedChunksRemoved = 0;
    if (orphanedDocIds.length > 0) {
      const deleteResult = await DocumentChunkModel.deleteMany({
        documentId: { $in: orphanedDocIds },
      });
      orphanedChunksRemoved = deleteResult.deletedCount || 0;
      console.log(`[Database Integrity] Removed ${orphanedChunksRemoved} orphaned chunks.`);
    }

    // 2. Clean invalid session references
    let cleanedSessionReferences = 0;
    const sessions = await ResearchSessionModel.find().lean();
    for (const session of sessions) {
      const invalidIds = (session.selectedDocumentIds || []).filter(
        (id) => !validDocIds.has(id.toString())
      );
      if (invalidIds.length > 0) {
        await ResearchSessionModel.findByIdAndUpdate(session._id, {
          $pull: { selectedDocumentIds: { $in: invalidIds } },
        });
        cleanedSessionReferences += invalidIds.length;
      }
    }

    return { orphanedChunksRemoved, cleanedSessionReferences };
  }
}
