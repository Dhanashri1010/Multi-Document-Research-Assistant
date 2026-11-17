import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { IngestionService } from '../services/documents/ingestionService.js';
import { ComparisonService } from '../services/ai/comparisonService.js';
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
   * Performs magic-byte verification, filename sanitization, and SHA-256 deduplication.
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
        // Magic-byte verification for PDF, DOCX, DOC
        const validation = await validateDocumentMagicBytes(file.path, file.originalname);
        if (!validation.isValid) {
          await fs.promises.unlink(file.path).catch(() => {});
          res.status(400).json({
            success: false,
            error: `Invalid file "${file.originalname}". ${validation.error || 'Only valid PDF, DOC, and DOCX files are permitted.'}`,
          });
          return;
        }

        const safeOriginalName = sanitizeFilename(file.originalname);

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
          originalName: safeOriginalName,
          fileSize: file.size,
          mimeType: file.mimetype,
          fileType: validation.format,
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
   * List all documents with optional filtering, search, sorting, and pagination.
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

      const filter: any = {};

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
        if (ft === 'pdf') {
          filter.$or = [{ fileType: 'pdf' }, { mimeType: 'application/pdf' }];
        } else if (ft === 'docx') {
          filter.$or = [{ fileType: 'docx' }, { originalName: /\.docx$/i }];
        } else if (ft === 'doc') {
          filter.$or = [{ fileType: 'doc' }, { originalName: /\.doc$/i }];
        } else if (ft === 'word') {
          filter.$or = [
            { fileType: { $in: ['docx', 'doc'] } },
            { originalName: /\.(docx|doc)$/i },
          ];
        } else if (ft === 'txt') {
          filter.mimeType = { $in: ['text/plain', 'text/txt'] };
        }
      }

      if (search && typeof search === 'string' && search.trim()) {
        const s = search.trim();
        const searchRegex = new RegExp(s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'), 'i');
        filter.$or = [
          { originalName: searchRegex },
          { title: searchRegex },
          { abstract: searchRegex },
          { authors: searchRegex },
        ];
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
      // Do not wipe summaryData or summaryText here; IngestionService safely preserves them if reprocessing fails
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
   * Summarize a single document (or retrieve cached summary if not regenerating).
   */
  static async summarize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docId = req.params.id as string;
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
   * Serve raw document PDF for in-app viewing or inline rendering.
   */
  static async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string);
      if (!doc || !doc.filePath) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      const uploadDir = path.resolve(process.cwd(), config.uploadDir);
      const resolvedPath = path.resolve(doc.filePath);
      if (!resolvedPath.startsWith(uploadDir) || !fs.existsSync(resolvedPath)) {
        res.status(404).json({ success: false, error: 'Document file not found on disk or invalid path.' });
        return;
      }

      const isDownload = req.query.download === 'true';
      res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${isDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(doc.originalName)}"`
      );
      fs.createReadStream(resolvedPath).pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download the exact original uploaded file.
   */
  static async downloadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const doc = await DocumentModel.findById(req.params.id as string);
      if (!doc || !doc.filePath) {
        res.status(404).json({ success: false, error: 'Document not found.' });
        return;
      }

      const uploadDir = path.resolve(process.cwd(), config.uploadDir);
      const resolvedPath = path.resolve(doc.filePath);
      if (!resolvedPath.startsWith(uploadDir) || !fs.existsSync(resolvedPath)) {
        res.status(404).json({ success: false, error: 'Document file not found on disk or invalid path.' });
        return;
      }

      res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalName)}"`);
      fs.createReadStream(resolvedPath).pipe(res);
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
      const rawCollection = req.body.collectionName;
      doc.collectionName = (rawCollection && typeof rawCollection === 'string' ? rawCollection.trim() : '') || 'General';
      await doc.save();
      res.json({ success: true, message: 'Collection updated.', document: doc });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all unique collections with document counts.
   */
  static async listCollections(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const counts = await DocumentModel.aggregate([
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
      if (!url || typeof url !== 'string') {
        res.status(400).json({ success: false, error: 'Please provide a valid arXiv URL or identifier.' });
        return;
      }

      // Extract arXiv ID e.g. 2106.09685 or 1706.03762
      const match = url.match(/(?:arxiv\.org\/(?:abs|pdf)\/|arxiv:)?([0-9]{4}\.[0-9]{4,5}(?:v[0-9]+)?)/i);
      if (!match || !match[1]) {
        res.status(400).json({
          success: false,
          error: 'Could not extract a valid arXiv ID from the provided URL. Expected format e.g. "https://arxiv.org/abs/2106.09685" or "2106.09685".',
        });
        return;
      }

      const arxivId = match[1];
      const pdfDownloadUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

      const uploadDir = config.uploadDir || './uploads';
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filename = `arxiv_${arxivId.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;
      const filePath = path.resolve(uploadDir, filename);

      // Download PDF from arXiv
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

      fs.writeFileSync(filePath, buffer);

      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Deduplication check
      const existing = await DocumentModel.findOne({ fileHash, status: 'ready' });
      if (existing) {
        fs.unlinkSync(filePath);
        res.json({
          success: true,
          message: 'Document already exists in corpus.',
          document: existing,
          isDuplicate: true,
        });
        return;
      }

      const doc = await DocumentModel.create({
        filename,
        originalName: `arXiv_${arxivId}.pdf`,
        fileSize: buffer.length,
        mimeType: 'application/pdf',
        filePath,
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
