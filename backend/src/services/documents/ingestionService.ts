import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import { DocumentModel } from '../../models/Document.js';
import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { extractPdf, extractTxt } from './extractor.js';
import { chunkPages, estimateTokenCount } from './chunker.js';
import { getEmbeddingProvider } from '../ai/embeddingService.js';
import { invalidateVectorCache } from '../ai/vectorStore.js';
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
   * Processes an uploaded document:
   * 1. Extracts per-page text (PDF or TXT) & page 1 metadata (title, authors, abstract)
   * 2. Cleans text & handles empty/scanned edge cases
   * 3. Chunks text cross-page with section headings
   * 4. Generates dense embeddings
   * 5. Saves chunks with embedding model/dim & updates document status to 'ready'
   */
  static async processDocument(documentId: string | Types.ObjectId): Promise<void> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      console.error(`[Ingestion] Document ${documentId} not found.`);
      return;
    }

    try {
      doc.status = 'processing';
      doc.errorDetails = undefined;
      await doc.save();

      console.log(`[Ingestion] Starting ingestion for: "${doc.originalName}" (${doc._id})`);

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

      console.log(`[Ingestion] Generated ${chunks.length} chunks (including Front-Matter chunk). Generating embeddings...`);

      // 3. Dense Embeddings (embed embeddingText if present for title/section context)
      const chunkTexts = chunks.map((c) => c.embeddingText || c.text);
      const embeddings = await embeddingProvider.embedDocuments(chunkTexts);
      const modelName = embeddingProvider.getModelName();
      const dim = embeddingProvider.getDimension();

      // 4. Batch Save Chunks to Database
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

      // Delete any previous chunks if reprocessing
      await DocumentChunkModel.deleteMany({ documentId: doc._id });
      await DocumentChunkModel.insertMany(chunkDocs);

      // Invalidate vector cache so fresh embeddings are loaded
      invalidateVectorCache(doc._id.toString());

      // 5. Update Document Status to 'ready'
      doc.status = 'ready';
      doc.pageCount = extraction.totalPages;
      doc.chunkCount = chunks.length;
      doc.embeddingModel = modelName;
      doc.embeddingDim = dim;
      doc.warning = extraction.warning;
      doc.isLowTextDensity = extraction.isLowTextDensity;
      await doc.save();

      if (extraction.warning) {
        console.warn(`[Ingestion] Warning for "${doc.originalName}": ${extraction.warning}`);
      }

      console.log(`[Ingestion] Successfully indexed "${doc.originalName}" with ${chunks.length} chunks (${modelName}, dim: ${dim}).`);
    } catch (err: any) {
      console.error(`[Ingestion] Error processing document "${doc.originalName}":`, err);
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
   * Safely deletes a document, removing:
   * 1. Associated chunk records and embeddings
   * 2. Physical file from disk
   * 3. Document record from database
   * 4. Invalidation of cached vectors
   */
  static async deleteDocument(documentId: string | Types.ObjectId): Promise<boolean> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) return false;

    // Delete chunks
    await DocumentChunkModel.deleteMany({ documentId: doc._id });

    // Invalidate vector cache
    invalidateVectorCache(doc._id.toString());

    // Delete stored file
    try {
      if (fs.existsSync(doc.filePath)) {
        await fs.promises.unlink(doc.filePath);
      }
    } catch (fsErr) {
      console.warn(`[Ingestion] Could not delete file ${doc.filePath}:`, fsErr);
    }

    // Delete doc record
    await DocumentModel.findByIdAndDelete(doc._id);
    return true;
  }
}
