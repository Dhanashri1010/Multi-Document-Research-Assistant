import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { IngestionService } from '../services/documents/ingestionService.js';
import { ComparisonService } from '../services/ai/comparisonService.js';
import { StorageService } from '../services/storage/supabaseStorage.js';
import {
  validatePdfMagicBytes,
  validatePdfBuffer,
  validateDocumentMagicBytes,
  sanitizeFilename,
} from '../utils/fileValidator.js';
import { config } from '../config/env.js';

export class DocumentController {
  /**
   * Upload one or multiple documents.
   * Performs magic-byte verification, filename sanitization, SHA-256 deduplication,
   * user-scoping, and cloud/local persistent storage.
   */
  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ success: false, error: 'No files were uploaded.' });
        return;
      }

      const userId = req.user?.userId;
      const createdDocs = [];

      for (const file of files) {
        // Magic-byte verification for PDF, DOCX, DOC
        const validation = await validateDocumentMagicBytes(file.path, file.originalname);
        if (!validation.isValid) {
          await fs.promises.unlink(file.path).catch(() => { });
          res.status(400).json({
            success: false,
            error: `Invalid file "${file.originalname}". ${validation.error || 'Only valid PDF, DOC, and DOCX files are permitted.'}`,
          });
          return;
        }

        const safeOriginalName = sanitizeFilename(file.originalname);
        const fileBuffer = await fs.promises.readFile(file.path);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Deduplication check: strictly scoped to the authenticated user's own documents.
        // Never return another user's document record across user boundaries.
        if (userId) {
          const existing = await DocumentModel.findOne({
            fileHash,
            userId: new mongoose.Types.ObjectId(userId),
            status: 'ready',
          });
          if (existing) {
            await fs.promises.unlink(file.path).catch(() => { });
            createdDocs.push(existing);
            continue;
          }
        }

        const docId = new mongoose.Types.ObjectId();
        const stored = await StorageService.saveDocumentFile(
          fileBuffer,
          file.originalname,
          userId || 'default',
          docId.toString(),
          file.mimetype
        );

        // Remove temporary upload file if stored elsewhere
        if (path.resolve(file.path) !== path.resolve(stored.localPath)) {
          await fs.promises.unlink(file.path).catch(() => { });
        }

        const doc = await DocumentModel.create({
          _id: docId,
          userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
          filename: file.filename,
          originalName: safeOriginalName,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileType: validation.format,
          filePath: stored.localPath,
          storageProvider: stored.storageProvider,
          storagePath: stored.storagePath,
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
   * List all documents with user-scoped isolation, filtering, search, sorting, and pagination.
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        search,
        status,
        fileType,
        category,
        collection,
        sortBy,
        page,
        limit,
      } = req.query as Record<string, string | undefined>;

      const userId = req.user?.userId;
      const filter: any = {};

      // User data isolation: user sees only their documents plus existing legacy documents
      if (userId) {
        filter.$or = [{ userId }, { userId: { $exists: false } }];
      }

      if (status && status !== 'all') {
        if (status === 'processing') {
          filter.status = { $in: ['uploaded', 'processing'] };
        } else {
          filter.status = status;
        }
      }

      if (category && category !== 'all') {
        filter.category = category;
      }

      if (collection && collection !== 'all') {
        filter.collectionName = collection;
      }

      if (fileType && fileType !== 'all') {
        const ft = fileType.toLowerCase();
        const typeConditions: any[] = [];
        if (ft === 'pdf') {
          typeConditions.push({ fileType: 'pdf' }, { mimeType: 'application/pdf' });
        } else if (ft === 'docx') {
          typeConditions.push({ fileType: 'docx' }, { originalName: /\.docx$/i });
        } else if (ft === 'doc') {
          typeConditions.push({ fileType: 'doc' }, { originalName: /\.doc$/i });
        } else if (ft === 'word') {
          typeConditions.push(
            { fileType: { $in: ['docx', 'doc'] } },
            { originalName: /\.(docx|doc)$/i }
          );
        } else if (ft === 'txt') {
          typeConditions.push({ mimeType: { $in: ['text/plain', 'text/txt'] } });
        }

        if (typeConditions.length > 0) {
          if (filter.$or) {
            filter.$and = [{ $or: filter.$or }, { $or: typeConditions }];
            delete filter.$or;
          } else {
            filter.$or = typeConditions;
          }
        }
      }

      if (search && typeof search === 'string' && search.trim()) {
        const s = search.trim();
        const searchRegex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
        const searchConditions = [
          { originalName: searchRegex },
          { title: searchRegex },
          { abstract: searchRegex },
          { authors: searchRegex },
        ];

        if (filter.$and) {
          filter.$and.push({ $or: searchConditions });
        } else if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
          delete filter.$or;
        } else {
          filter.$or = searchConditions;
        }
      }

      let sortOption: any = { createdAt: -1 };
      if (sortBy === 'oldest') {
        sortOption = { createdAt: 1 };
      } else if (sortBy === 'name-asc') {
        sortOption = { originalName: 1 };
      } else if (sortBy === 'name-desc') {
        sortOption = { originalName: -1 };
      } else if (sortBy === 'pages-desc') {
        sortOption = { pageCount: -1 };
      } else if (sortBy === 'pages-asc') {
        sortOption = { pageCount: 1 };
      }

      const total = await DocumentModel.countDocuments(filter);

      let query = DocumentModel.find(filter).sort(sortOption);

      const parsedLimit = limit ? parseInt(limit, 10) : 0;
      const parsedPage = page ? parseInt(page, 10) : 1;

      if (parsedLimit > 0) {
        const skip = Math.max(0, (parsedPage - 1) * parsedLimit);
        query = query.skip(skip).limit(parsedLimit);
      }

      const docs = await query.exec();

      res.json({
        success: true,
        documents: docs,
        total,
        page: parsedPage,
        totalPages: parsedLimit > 0 ? Math.ceil(total / parsedLimit) : 1,
        limit: parsedLimit,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get workspace statistics for the dashboard scoped to user.
   */
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const baseFilter: any = userId ? { $or: [{ userId }, { userId: { $exists: false } }] } : {};

      const [total, ready, processing, failed, recent] = await Promise.all([
        DocumentModel.countDocuments(baseFilter),
        DocumentModel.countDocuments({ ...baseFilter, status: 'ready' }),
        DocumentModel.countDocuments({ ...baseFilter, status: { $in: ['uploaded', 'processing'] } }),
        DocumentModel.countDocuments({ ...baseFilter, status: 'failed' }),
        DocumentModel.find(baseFilter).sort({ createdAt: -1 }).limit(5),
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
   * Helper to check document ownership.
   */
  private static checkOwnership(doc: any, userId?: string): boolean {
    if (!doc.userId) return true; // Legacy document
    if (!userId) return false;
    return doc.userId.toString() === userId;
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

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not have permission to view this document.' });
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
      const doc = await DocumentModel.findById(req.params.id as string).select(
        'userId status errorDetails pageCount chunkCount updatedAt'
      );
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied.' });
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

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not own this document.' });
        return;
      }

      doc.status = 'processing';
      doc.errorDetails = undefined;
      doc.ingestAttempts = 0;
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
      const doc = await DocumentModel.findById(docId);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found or already deleted.' });
        return;
      }

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not have permission to delete this document.' });
        return;
      }

      await StorageService.deleteDocumentFile(doc);
      await IngestionService.deleteDocument(docId);

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
   * Summarize a single document (or retrieve cached summary if not regenerating).
   */
  static async summarize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docId = req.params.id as string;
      const doc = await DocumentModel.findById(docId);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not own this document.' });
        return;
      }

      const regenerate = Boolean(req.body?.regenerate);
      const summaryResult = await ComparisonService.summarize(docId, regenerate);
      res.json({
        success: true,
        ...summaryResult,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Serve raw document for in-app viewing or inline rendering via Supabase / local storage.
   */
  static async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not have permission to view this file.' });
        return;
      }

      const buffer = await StorageService.getDocumentBuffer(doc);
      const isDownload = req.query.download === 'true';

      res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.originalName)}"`
      );
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download the exact original uploaded file via Supabase / local storage.
   */
  static async downloadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not have permission to download this file.' });
        return;
      }

      const buffer = await StorageService.getDocumentBuffer(doc);

      res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update document collection / project group.
   */
  static async updateCollection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not own this document.' });
        return;
      }

      const rawCollection = req.body.collectionName;
      doc.collectionName = (rawCollection && typeof rawCollection === 'string' ? rawCollection.trim() : '') || 'General';
      await doc.save();
      res.json({ success: true, message: 'Collection updated.', document: doc });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all unique collections with document counts scoped to user.
   */
  static async listCollections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      const matchStage: any = userId
        ? { $match: { $or: [{ userId: new mongoose.Types.ObjectId(userId) }, { userId: { $exists: false } }] } }
        : { $match: {} };

      const counts = await DocumentModel.aggregate([
        matchStage,
        { $group: { _id: { $ifNull: ['$collectionName', 'General'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const collections = counts.map((c) => ({
        name: c._id || 'General',
        count: c.count,
      }));
      res.json({ success: true, collections });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Import academic paper directly from arXiv URL.
   */
  static async importArxiv(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url, collectionName } = req.body;
      const userId = req.user?.userId;

      if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'Please provide a valid arXiv URL or identifier.' });
        return;
      }

      const match = url.match(/(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:)?([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?)/i);
      if (!match || !match[1]) {
        res.status(400).json({
          success: false,
          error: 'Could not extract a valid arXiv ID from the provided URL.',
        });
        return;
      }

      const arxivId = match[1];
      const pdfDownloadUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

      const response = await fetch(pdfDownloadUrl, {
        headers: {
          'User-Agent': 'MultiDocumentResearchAssistant/1.0 (academic-nlp-tool)',
        },
      });

      if (!response.ok) {
        res.status(502).json({
          success: false,
          error: `Failed to download PDF from arXiv (${response.status}: ${response.statusText}).`,
        });
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!validatePdfBuffer(buffer)) {
        res.status(400).json({
          success: false,
          error: 'Downloaded arXiv payload does not begin with valid PDF magic bytes "%PDF-".',
        });
        return;
      }

      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
      // Deduplication strictly scoped to user's documents
      if (userId) {
        const existing = await DocumentModel.findOne({
          fileHash,
          userId: new mongoose.Types.ObjectId(userId),
          status: 'ready',
        });
        if (existing) {
          res.json({
            success: true,
            message: 'Document already exists in your workspace.',
            document: existing,
            isDuplicate: true,
          });
          return;
        }
      }

      const docId = new mongoose.Types.ObjectId();
      const filename = `arxiv_${arxivId.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;
      const stored = await StorageService.saveDocumentFile(
        buffer,
        `arXiv_${arxivId}.pdf`,
        userId || 'default',
        docId.toString(),
        'application/pdf'
      );

      const doc = await DocumentModel.create({
        _id: docId,
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        filename,
        originalName: `arXiv_${arxivId}.pdf`,
        fileSize: buffer.length,
        mimeType: 'application/pdf',
        filePath: stored.localPath,
        storageProvider: stored.storageProvider,
        storagePath: stored.storagePath,
        fileHash,
        collectionName: (collectionName && typeof collectionName === 'string' ? collectionName.trim() : '') || 'arXiv',
        status: 'uploaded',
      });

      IngestionService.queueDocument(doc._id).catch((err) => {
        console.error(`[DocumentController] Background ingestion failed for arXiv ${doc._id}:`, err);
      });

      res.status(201).json({
        success: true,
        message: `Successfully fetched and queued arXiv paper ${arxivId} for ingestion.`,
        document: doc,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all text chunks and structured headings for a document (used for Word document in-app preview).
   */
  static async getChunks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docId = req.params.id as string;
      const doc = await DocumentModel.findById(docId);
      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      if (!DocumentController.checkOwnership(doc, req.user?.userId)) {
        res.status(403).json({ success: false, error: 'Access denied: You do not own this document.' });
        return;
      }

      const chunks = await DocumentChunkModel.find({ documentId: docId })
        .select('chunkIndex text heading section paragraphNumber fileType pageNumber pageStart pageEnd')
        .sort({ chunkIndex: 1 })
        .lean();

      res.json({ success: true, chunks });
    } catch (err) {
      next(err);
    }
  }
}
