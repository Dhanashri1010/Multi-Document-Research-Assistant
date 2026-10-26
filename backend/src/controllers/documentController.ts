import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { DocumentModel } from '../models/Document.js';
import { IngestionService } from '../services/documents/ingestionService.js';
import { ComparisonService } from '../services/ai/comparisonService.js';

export class DocumentController {
  /**
   * Upload one or multiple documents.
   * Performs SHA-256 deduplication: if identical file is already processed, reuses existing record.
   * Immediately persists new records and enqueues background ingestion.
   */
  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: 'No files were uploaded.' });
        return;
      }

      const createdDocs = [];

      for (const file of files) {
        // Compute SHA-256 file hash
        let fileHash: string | undefined;
        try {
          const fileBuffer = await fs.promises.readFile(file.path);
          fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch {
          // If hashing fails, proceed without hash
        }

        // Deduplication check: if an identical document is already indexed and ready, reuse it
        if (fileHash) {
          const existing = await DocumentModel.findOne({ fileHash, status: 'ready' });
          if (existing) {
            // Remove redundant temporary upload file
            await fs.promises.unlink(file.path).catch(() => {});
            createdDocs.push(existing);
            continue;
          }
        }

        const doc = await DocumentModel.create({
          filename: file.filename,
          originalName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          filePath: file.path,
          fileHash,
          status: 'uploaded',
        });

        createdDocs.push(doc);

        // Enqueue document into serial ingestion queue
        IngestionService.queueDocument(doc._id).catch((err) => {
          console.error(`[DocumentController] Background processing failed for ${doc._id}:`, err);
        });
      }

      res.status(201).json({
        success: true,
        message: `Processed ${createdDocs.length} file(s).`,
        documents: createdDocs,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all documents.
   */
  static async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await DocumentModel.find().sort({ createdAt: -1 });
      res.json({
        success: true,
        documents: docs,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get workspace statistics for the dashboard.
   */
  static async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const [total, ready, processing, failed, recent] = await Promise.all([
        DocumentModel.countDocuments(),
        DocumentModel.countDocuments({ status: 'ready' }),
        DocumentModel.countDocuments({ status: { $in: ['uploaded', 'processing'] } }),
        DocumentModel.countDocuments({ status: 'failed' }),
        DocumentModel.find().sort({ createdAt: -1 }).limit(5),
      ]);

      res.json({
        success: true,
        stats: {
          totalDocuments: total,
          readyDocuments: ready,
          processingDocuments: processing,
          failedDocuments: failed,
        },
        recentDocuments: recent,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single document details.
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }
      res.json({ success: true, document: doc });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get document processing status.
   */
  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string).select('status errorDetails pageCount chunkCount updatedAt');
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }
      res.json({
        success: true,
        status: doc.status,
        errorDetails: doc.errorDetails,
        pageCount: doc.pageCount,
        chunkCount: doc.chunkCount,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retry processing for a failed document.
   */
  static async reprocess(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      doc.status = 'processing';
      doc.errorDetails = undefined;
      await doc.save();

      IngestionService.queueDocument(doc._id).catch((err) => {
        console.error(`[DocumentController] Reprocessing failed for ${doc._id}:`, err);
      });

      res.json({
        success: true,
        message: 'Reprocessing initiated.',
        document: doc,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a document and its associated vectors and storage file.
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docId = req.params.id as string;
      const success = await IngestionService.deleteDocument(docId);
      if (!success) {
        res.status(404).json({ success: false, error: 'Document not found or already deleted.' });
        return;
      }
      res.json({ success: true, message: 'Document and associated vectors deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Re-index all documents using the active embedding model.
   */
  static async reindexAll(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await IngestionService.reindexAllDocuments();
      res.json({
        success: true,
        message: `Re-indexed ${result.succeeded} of ${result.total} documents.`,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Summarize a single document.
   */
  static async summarize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docId = req.params.id as string;
      const summaryResult = await ComparisonService.summarize(docId);
      res.json({
        success: true,
        ...summaryResult,
      });
    } catch (err) {
      next(err);
    }
  }
}
