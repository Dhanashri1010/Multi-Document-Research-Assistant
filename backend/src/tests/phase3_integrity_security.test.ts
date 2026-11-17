import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import { Types } from 'mongoose';
import { IngestionService } from '../services/documents/ingestionService.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { ResearchSessionModel } from '../models/ResearchSession.js';
import { sanitizeErrorMessage } from '../middleware/errorHandler.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { validatePdfBuffer, sanitizeFilename } from '../utils/fileValidator.js';
import * as extractor from '../services/documents/extractor.js';

describe('Phase 3: Safe Document Reprocessing', () => {
  it('safely reprocesses document and updates chunks and metadata', async () => {
    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      filename: 'sample.pdf',
      originalName: 'Sample Paper.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
      filePath: './uploads/sample.pdf',
      pageCount: 1,
      chunkCount: 1,
      status: 'ready',
      summaryData: { overview: 'Old summary' },
    });

    const docFindSpy = vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);
    const extractSpy = vi.spyOn(extractor, 'extractPdf').mockResolvedValue({
      totalPages: 2,
      fullText: 'Page 1 new text. Page 2 new methodology.',
      pages: [
        { pageNumber: 1, text: 'Page 1 new text content.' },
        { pageNumber: 2, text: 'Page 2 new methodology and evaluation.' },
      ],
    });

    const fakeEmbedder = {
      embedDocuments: vi.fn().mockImplementation(async (texts: string[]) => {
        return texts.map((_, i) => new Array(384).fill(0.1 * (i + 1)));
      }),
      embedQuery: vi.fn(),
      getModelName: () => 'all-MiniLM-L6-v2',
      getDimension: () => 384,
    };
    const embedProviderSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const chunkInsertSpy = vi.spyOn(DocumentChunkModel, 'insertMany').mockImplementation(
      ((docs: any[]) => Promise.resolve(docs.map(() => ({ _id: new Types.ObjectId() })))) as any
    );
    const chunkDeleteSpy = vi.spyOn(DocumentChunkModel, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 1 } as any);
    const countSpy = vi.spyOn(DocumentChunkModel, 'countDocuments').mockResolvedValue(1);
    const docSaveSpy = vi.spyOn(fakeDoc, 'save').mockResolvedValue(fakeDoc);

    await IngestionService.processDocument(docId);

    expect(extractSpy).toHaveBeenCalled();
    expect(fakeEmbedder.embedDocuments).toHaveBeenCalled();
    expect(chunkInsertSpy).toHaveBeenCalled();
    expect(chunkDeleteSpy).toHaveBeenCalled();
    expect(fakeDoc.status).toBe('ready');
    expect(fakeDoc.pageCount).toBe(2);

    docFindSpy.mockRestore();
    extractSpy.mockRestore();
    embedProviderSpy.mockRestore();
    chunkInsertSpy.mockRestore();
    chunkDeleteSpy.mockRestore();
    countSpy.mockRestore();
    docSaveSpy.mockRestore();
  });

  it('preserves existing working chunks, embeddings, and summary when reprocessing encounters failure', async () => {
    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      filename: 'sample_failing.pdf',
      originalName: 'Sample Paper Failing.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      filePath: './uploads/sample_failing.pdf',
      pageCount: 3,
      chunkCount: 4,
      status: 'ready',
      summaryData: { overview: 'Critical existing summary that must NOT be lost' },
      summaryText: 'Summary text content',
      category: 'Research Paper',
    });

    const docFindSpy = vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);

    // Simulate extraction failure (e.g. temporary file lock or corrupted temp stream during reprocess)
    const extractSpy = vi.spyOn(extractor, 'extractPdf').mockRejectedValue(
      new Error('Temporary read failure during PDF extraction')
    );

    // Mock countDocuments returning that previous 4 chunks still exist in DB
    const countSpy = vi.spyOn(DocumentChunkModel, 'countDocuments').mockResolvedValue(4);
    const docSaveSpy = vi.spyOn(fakeDoc, 'save').mockResolvedValue(fakeDoc);

    await IngestionService.processDocument(docId);

    // Document status must remain 'ready' with previous summary and chunks intact
    expect(fakeDoc.status).toBe('ready');
    expect(fakeDoc.chunkCount).toBe(4);
    expect(fakeDoc.summaryData).toBeDefined();
    expect(fakeDoc.summaryData.overview).toBe('Critical existing summary that must NOT be lost');
    expect(fakeDoc.summaryText).toBe('Summary text content');
    expect(fakeDoc.category).toBe('Research Paper');
    expect(fakeDoc.errorDetails).toContain('Previously indexed version with 4 chunks was safely preserved');

    docFindSpy.mockRestore();
    extractSpy.mockRestore();
    countSpy.mockRestore();
    docSaveSpy.mockRestore();
  });
});

describe('Phase 3: Cascade Document Deletion & Session Cleanup', () => {
  it('removes associated chunks, file, doc record, and pulls ID from all research sessions', async () => {
    const targetDocId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: targetDocId,
      filename: 'delete_me.pdf',
      originalName: 'Delete Me.pdf',
      filePath: './uploads/delete_me.pdf',
      status: 'ready',
    });

    const docFindSpy = vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);
    const docDeleteSpy = vi.spyOn(DocumentModel, 'findByIdAndDelete').mockResolvedValue(fakeDoc);
    const chunkDeleteSpy = vi.spyOn(DocumentChunkModel, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 5 } as any);
    const sessionUpdateSpy = vi.spyOn(ResearchSessionModel, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 2 } as any);
    const fsExistsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const fsUnlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

    const result = await IngestionService.deleteDocument(targetDocId);

    expect(result).toBe(true);

    // 1. Session reference cascade cleanup
    expect(sessionUpdateSpy).toHaveBeenCalledWith(
      { selectedDocumentIds: targetDocId },
      { $pull: { selectedDocumentIds: targetDocId } }
    );

    // 2. Chunks cascade cleanup
    expect(chunkDeleteSpy).toHaveBeenCalledWith({ documentId: targetDocId });

    // 3. Storage file deleted
    expect(fsUnlinkSpy).toHaveBeenCalledWith('./uploads/delete_me.pdf');

    // 4. Document record deleted
    expect(docDeleteSpy).toHaveBeenCalledWith(targetDocId);

    docFindSpy.mockRestore();
    docDeleteSpy.mockRestore();
    chunkDeleteSpy.mockRestore();
    sessionUpdateSpy.mockRestore();
    fsExistsSpy.mockRestore();
    fsUnlinkSpy.mockRestore();
  });

  it('resiliently cleans database references even if physical file unlinking encounters an error', async () => {
    const targetDocId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: targetDocId,
      filename: 'file_missing.pdf',
      originalName: 'File Missing.pdf',
      filePath: './uploads/file_missing.pdf',
      status: 'ready',
    });

    const docFindSpy = vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);
    const docDeleteSpy = vi.spyOn(DocumentModel, 'findByIdAndDelete').mockResolvedValue(fakeDoc);
    const chunkDeleteSpy = vi.spyOn(DocumentChunkModel, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 2 } as any);
    const sessionUpdateSpy = vi.spyOn(ResearchSessionModel, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 1 } as any);
    const fsExistsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    // Simulate filesystem EPERM / ENOENT error
    const fsUnlinkSpy = vi.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('EBUSY: resource locked'));

    const result = await IngestionService.deleteDocument(targetDocId);

    // Must still succeed in deleting DB records and session links
    expect(result).toBe(true);
    expect(sessionUpdateSpy).toHaveBeenCalledWith(
      { selectedDocumentIds: targetDocId },
      { $pull: { selectedDocumentIds: targetDocId } }
    );
    expect(chunkDeleteSpy).toHaveBeenCalledWith({ documentId: targetDocId });
    expect(docDeleteSpy).toHaveBeenCalledWith(targetDocId);

    docFindSpy.mockRestore();
    docDeleteSpy.mockRestore();
    chunkDeleteSpy.mockRestore();
    sessionUpdateSpy.mockRestore();
    fsExistsSpy.mockRestore();
    fsUnlinkSpy.mockRestore();
  });
});

describe('Phase 3: Database Integrity & Orphaned Reference Cleanup', () => {
  it('detects and cleans up orphaned chunks and invalid session document IDs', async () => {
    const validDocId1 = new Types.ObjectId();
    const validDocId2 = new Types.ObjectId();
    const orphanedDocId = new Types.ObjectId();

    // Mock DocumentModel.find returning only validDocId1 and validDocId2
    const docFindSpy = vi.spyOn(DocumentModel, 'find').mockReturnValue({
      select: () => ({
        lean: () => Promise.resolve([{ _id: validDocId1 }, { _id: validDocId2 }]),
      }),
    } as any);

    // Mock DocumentChunkModel.distinct returning all 3 IDs
    const distinctSpy = vi.spyOn(DocumentChunkModel, 'distinct').mockResolvedValue([
      validDocId1,
      validDocId2,
      orphanedDocId,
    ] as any);

    const chunkDeleteSpy = vi.spyOn(DocumentChunkModel, 'deleteMany').mockResolvedValue({
      acknowledged: true,
      deletedCount: 12,
    } as any);

    // Mock sessions with one referencing the orphanedDocId
    const sessionFindSpy = vi.spyOn(ResearchSessionModel, 'find').mockReturnValue({
      lean: () =>
        Promise.resolve([
          {
            _id: new Types.ObjectId(),
            title: 'Session Alpha',
            selectedDocumentIds: [validDocId1, orphanedDocId],
          },
        ]),
    } as any);

    const sessionUpdateSpy = vi.spyOn(ResearchSessionModel, 'findByIdAndUpdate').mockResolvedValue({} as any);

    const report = await IngestionService.verifyAndCleanDatabaseIntegrity();

    expect(report.orphanedChunksRemoved).toBe(12);
    expect(report.cleanedSessionReferences).toBe(1);
    expect(chunkDeleteSpy).toHaveBeenCalledWith({
      documentId: { $in: [orphanedDocId] },
    });

    docFindSpy.mockRestore();
    distinctSpy.mockRestore();
    chunkDeleteSpy.mockRestore();
    sessionFindSpy.mockRestore();
    sessionUpdateSpy.mockRestore();
  });
});

describe('Phase 3: API Security & Error Sanitization', () => {
  it('sanitizes Windows drive paths, POSIX paths, API keys, and credentials from error messages', () => {
    const rawError =
      'Failed connecting to C:\\Users\\Administrator\\secret\\config.json with API key AIzaSyFakeSecretKey99887766554433221100 and Bearer token eyJhbGciOi at /var/www/internal/db.ts';

    const safe = sanitizeErrorMessage(rawError);

    expect(safe).not.toContain('C:\\Users\\Administrator');
    expect(safe).not.toContain('AIzaSyFakeSecretKey');
    expect(safe).not.toContain('eyJhbGciOi');
    expect(safe).not.toContain('/var/www/internal');
    expect(safe).toContain('[internal path]');
    expect(safe).toContain('[redacted API key]');
    expect(safe).toContain('[redacted credential]');
  });

  it('validates PDF magic bytes accurately from buffers', () => {
    const validPdf = Buffer.from('%PDF-1.7\nSample content');
    const invalidPdf = Buffer.from('NOT_A_PDF_DOCUMENT');
    const emptyBuffer = Buffer.from('');

    expect(validatePdfBuffer(validPdf)).toBe(true);
    expect(validatePdfBuffer(invalidPdf)).toBe(false);
    expect(validatePdfBuffer(emptyBuffer)).toBe(false);
  });

  it('sanitizes filenames to prevent path traversal and shell injection', () => {
    expect(sanitizeFilename('../../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\Windows\\System32\\cmd.exe')).toBe('cmd.exe');
    expect(sanitizeFilename('paper: "test" <version>.pdf')).toBe('paper_ _test_ _version_.pdf');
    expect(sanitizeFilename('   ')).toMatch(/^document_\d+\.pdf$/);
  });
});

describe('Phase 3: Rate Limiting Middleware', () => {
  it('allows requests within threshold and returns 429 with Retry-After when exceeded', () => {
    const limiter = createRateLimiter({
      windowMs: 1000,
      max: 2,
      message: 'Rate limit exceeded.',
    });

    let statusCode = 200;
    let jsonResponse: any = null;
    let headers: Record<string, any> = {};

    const mockRes: any = {
      setHeader: (key: string, val: any) => {
        headers[key] = val;
      },
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonResponse = data;
          },
        };
      },
    };

    const mockReq: any = {
      ip: '192.168.1.100',
      headers: {},
      socket: {},
    };

    let nextCalled = false;
    const mockNext = () => {
      nextCalled = true;
    };

    // Request 1: Should pass
    nextCalled = false;
    limiter(mockReq, mockRes, mockNext);
    expect(nextCalled).toBe(true);
    expect(statusCode).toBe(200);

    // Request 2: Should pass
    nextCalled = false;
    limiter(mockReq, mockRes, mockNext);
    expect(nextCalled).toBe(true);
    expect(statusCode).toBe(200);

    // Request 3: Exceeds quota (max: 2), must return 429
    nextCalled = false;
    limiter(mockReq, mockRes, mockNext);
    expect(nextCalled).toBe(false);
    expect(statusCode).toBe(429);
    expect(jsonResponse.success).toBe(false);
    expect(jsonResponse.error).toBe('Rate Limit Exceeded');
    expect(headers['Retry-After']).toBeDefined();
    expect(headers['X-RateLimit-Limit']).toBe(2);
    expect(headers['X-RateLimit-Remaining']).toBe(0);
  });
});
