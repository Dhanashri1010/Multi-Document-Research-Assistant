import { describe, it, expect, vi } from 'vitest';
import { Types } from 'mongoose';
import fs from 'fs';
import { IngestionService } from '../services/documents/ingestionService.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { ResearchSessionModel } from '../models/ResearchSession.js';
import { ChatMessageModel } from '../models/ChatMessage.js';
import { RAGService } from '../services/ai/ragService.js';
import { ComparisonService } from '../services/ai/comparisonService.js';
import { LLMService } from '../services/ai/llmService.js';
import { CitationVerifier } from '../services/ai/citationVerifier.js';
import { sanitizeErrorMessage } from '../middleware/errorHandler.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { validatePdfBuffer, sanitizeFilename } from '../utils/fileValidator.js';
import * as extractor from '../services/documents/extractor.js';

describe('Phase 5: Document Management Verification', () => {
  it('validates authentic PDF buffers and rejects non-PDF / corrupted files', () => {
    // Valid PDF buffer starting with %PDF-
    const validPdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    expect(validatePdfBuffer(validPdfBuffer)).toBe(true);

    // Corrupted file (PNG header instead of PDF)
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validatePdfBuffer(pngBuffer)).toBe(false);

    // Empty or zero-byte buffer
    expect(validatePdfBuffer(Buffer.alloc(0))).toBe(false);

    // Truncated buffer under 5 bytes
    expect(validatePdfBuffer(Buffer.from('%PD'))).toBe(false);
  });

  it('sanitizes malicious filenames and prevents path traversal attacks', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');
    expect(sanitizeFilename('my folder/nested document.pdf')).toBe('nested document.pdf');
    expect(sanitizeFilename('normal_paper.pdf')).toBe('normal_paper.pdf');
  });

  it('safely reprocesses document and updates chunks and metadata', async () => {
    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      filename: 'paper_v1.pdf',
      originalName: 'Transformer Architecture.pdf',
      fileSize: 2048,
      mimeType: 'application/pdf',
      filePath: './uploads/paper_v1.pdf',
      pageCount: 1,
      chunkCount: 1,
      status: 'ready',
      summaryData: { overview: 'Old overview' },
    });

    const docFindSpy = vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);
    const extractSpy = vi.spyOn(extractor, 'extractPdf').mockResolvedValue({
      totalPages: 3,
      fullText: 'Page 1 intro. Page 2 attention. Page 3 results.',
      pages: [
        { pageNumber: 1, text: 'Page 1 intro.' },
        { pageNumber: 2, text: 'Page 2 attention.' },
        { pageNumber: 3, text: 'Page 3 results.' },
      ],
    });

    const fakeEmbedder = {
      embedDocuments: vi.fn().mockImplementation(async (texts: string[]) => {
        return texts.map((_, i) => new Array(384).fill(0.05 * (i + 1)));
      }),
      embedQuery: vi.fn(),
      getModelName: () => 'all-MiniLM-L6-v2',
      getDimension: () => 384,
    };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const chunkInsertSpy = vi.spyOn(DocumentChunkModel, 'insertMany').mockImplementation(
      ((docs: any[]) => Promise.resolve(docs.map(() => ({ _id: new Types.ObjectId() })))) as any
    );
    const chunkDeleteSpy = vi.spyOn(DocumentChunkModel, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 1 } as any);
    const countSpy = vi.spyOn(DocumentChunkModel, 'countDocuments').mockResolvedValue(1);
    const docSaveSpy = vi.spyOn(fakeDoc, 'save').mockResolvedValue(fakeDoc);

    await IngestionService.processDocument(docId);

    expect(extractSpy).toHaveBeenCalled();
    expect(chunkInsertSpy).toHaveBeenCalled();
    expect(chunkDeleteSpy).toHaveBeenCalled();
    expect(fakeDoc.status).toBe('ready');
    expect(fakeDoc.pageCount).toBe(3);

    docFindSpy.mockRestore();
    extractSpy.mockRestore();
    embedSpy.mockRestore();
    chunkInsertSpy.mockRestore();
    chunkDeleteSpy.mockRestore();
    countSpy.mockRestore();
    docSaveSpy.mockRestore();
  });

  it('cascades document deletion across chunks, physical files, and session references', async () => {
    const docId = new Types.ObjectId();

    const fakeDoc = new DocumentModel({
      _id: docId,
      filename: 'sample_delete.pdf',
      originalName: 'Sample Delete.pdf',
      filePath: './uploads/sample_delete.pdf',
      status: 'ready',
    });

    const docFindSpy = vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);
    const chunkDeleteSpy = vi.spyOn(DocumentChunkModel, 'deleteMany').mockResolvedValue({ acknowledged: true, deletedCount: 5 } as any);
    const existsSpy = vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
    const sessionUpdateSpy = vi.spyOn(ResearchSessionModel, 'updateMany').mockResolvedValue({ acknowledged: true, modifiedCount: 2 } as any);
    const docDeleteSpy = vi.spyOn(DocumentModel, 'findByIdAndDelete').mockResolvedValue(fakeDoc as any);

    await IngestionService.deleteDocument(docId);

    expect(chunkDeleteSpy).toHaveBeenCalledWith({ documentId: docId });
    expect(unlinkSpy).toHaveBeenCalledWith('./uploads/sample_delete.pdf');
    expect(sessionUpdateSpy).toHaveBeenCalledWith(
      { selectedDocumentIds: docId },
      { $pull: { selectedDocumentIds: docId } }
    );
    expect(docDeleteSpy).toHaveBeenCalledWith(docId);

    docFindSpy.mockRestore();
    chunkDeleteSpy.mockRestore();
    existsSpy.mockRestore();
    unlinkSpy.mockRestore();
    sessionUpdateSpy.mockRestore();
    docDeleteSpy.mockRestore();
  });
});

describe('Phase 5: RAG & Cross-Document Synthesis Verification', () => {
  it('passes prior 6 conversation messages to query rewriting for contextual follow-up questions', async () => {
    const docId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();

    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Attention Is All You Need.pdf',
      status: 'ready',
      chunkCount: 10,
    });

    const fakeSession = new ResearchSessionModel({
      _id: sessionId,
      title: 'Attention Discussion',
      selectedDocumentIds: [docId],
    });
    fakeSession.save = vi.fn().mockResolvedValue(fakeSession);

    const priorMessages = [
      { role: 'user', content: 'What is the attention mechanism in this paper?' },
      { role: 'assistant', content: 'The paper introduces Scaled Dot-Product Attention.' },
      { role: 'user', content: 'How many heads are used in multi-head attention?' },
      { role: 'assistant', content: 'The model uses 8 parallel attention heads.' },
    ];

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValue(fakeSession as any);
    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([...priorMessages].reverse()),
        }),
      }),
    } as any);

    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ role: 'assistant', content: '8 heads.' }),
      }),
    } as any);

    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);
    const rewriteSpy = vi.spyOn(RAGService, 'rewriteQuery').mockResolvedValue('multi-head attention parameter dimension for 8 heads');

    const fakeEmbedder = {
      embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)),
    };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'For each of the 8 heads we use dk = dv = 64 dimensions.',
          pageNumber: 4,
          section: 'Multi-Head Attention',
        } as any,
        score: 0.88,
        denseScore: 0.88,
      },
    ]);

    const citeVerifierSpy = vi.spyOn(CitationVerifier, 'verifyAllClaims').mockResolvedValue([
      {
        claim: 'Each head operates with dk = dv = 64 dimensions.',
        sourceIndices: [1],
        verifiedIndices: [1],
        unsupportedIndices: [],
        confidence: 'high',
        isFullySupported: true,
      },
    ]);

    const llmSpy = vi.spyOn(LLMService, 'generate').mockResolvedValue(
      JSON.stringify({
        answer: 'Each head operates with dk = dv = 64 dimensions.',
        claims: [
          { claimText: 'Each head operates with dk = dv = 64 dimensions.', sourcePassageIndices: [1] },
        ],
        hasInsufficientEvidence: false,
      })
    );

    const response = await RAGService.ask({
      question: 'What is their dimension?',
      documentIds: [docId.toString()],
      sessionId: sessionId.toString(),
    });

    expect(rewriteSpy).toHaveBeenCalledWith(
      'What is their dimension?',
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'How many heads are used in multi-head attention?' }),
      ])
    );
    expect(response.answer).toContain('dk = dv = 64');
    expect(response.citations.length).toBe(1);
    expect(response.citations[0].pageNumber).toBe(4);

    docSpy.mockRestore();
    sessionSpy.mockRestore();
    msgFindSpy.mockRestore();
    msgFindOneSpy.mockRestore();
    msgCreateSpy.mockRestore();
    rewriteSpy.mockRestore();
    embedSpy.mockRestore();
    vectorSpy.mockRestore();
    citeVerifierSpy.mockRestore();
    llmSpy.mockRestore();
  });

  it('correctly reports insufficient evidence without fabricating answers when score is below adaptive threshold', async () => {
    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Biology Notes.pdf',
      status: 'ready',
      chunkCount: 20,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.01)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    // No chunks returned because relevance is completely absent
    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([]);

    const response = await RAGService.ask({
      question: 'What is the stock price of Apple on May 2024?',
      documentIds: [docId.toString()],
    });

    expect(response.hasInsufficientEvidence).toBe(true);
    expect(response.answer).toContain('Biology Notes.pdf');
    expect(response.answer).toContain('does not contain enough information');
    expect(response.citations.length).toBe(0);

    docSpy.mockRestore();
    sessionSpy.mockRestore();
    msgFindSpy.mockRestore();
    msgFindOneSpy.mockRestore();
    msgCreateSpy.mockRestore();
    embedSpy.mockRestore();
    vectorSpy.mockRestore();
  });

  it('safely falls back to grounded excerpts when Gemini returns 503 or 429', async () => {
    const docId = new Types.ObjectId();
    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'Quantum Computing.pdf',
      status: 'ready',
      chunkCount: 8,
    });

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'create').mockResolvedValue({
      _id: new Types.ObjectId(),
      save: vi.fn(),
    } as any);

    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as any);
    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'Superconducting qubits operate at 15 millikelvin temperatures.',
          pageNumber: 2,
          section: 'Hardware',
        } as any,
        score: 0.92,
        denseScore: 0.92,
      },
    ]);

    // Simulate 503 Service Overloaded error from LLM
    const overloadedErr = new Error('503 The model is overloaded. Please try again later.');
    (overloadedErr as any).status = 503;
    const llmSpy = vi.spyOn(LLMService, 'generate').mockRejectedValue(overloadedErr);

    const response = await RAGService.ask({
      question: 'What temperature is required for superconducting qubits?',
      documentIds: [docId.toString()],
    });

    expect(response.degraded).toBe(true);
    expect(response.degradedReason).toContain('503 Service Unavailable');
    expect(response.answer).toContain('Superconducting qubits operate at 15 millikelvin');
    expect(response.citations.length).toBe(1);
    expect(response.citations[0].pageNumber).toBe(2);

    docSpy.mockRestore();
    sessionSpy.mockRestore();
    msgFindSpy.mockRestore();
    msgFindOneSpy.mockRestore();
    msgCreateSpy.mockRestore();
    embedSpy.mockRestore();
    vectorSpy.mockRestore();
    llmSpy.mockRestore();
  });

  it('guarantees all 10 evaluation dimensions in multi-document comparison', async () => {
    const doc1Id = new Types.ObjectId();
    const doc2Id = new Types.ObjectId();

    const fakeDocs = [
      new DocumentModel({ _id: doc1Id, originalName: 'Paper Alpha.pdf', status: 'ready', pageCount: 10 }),
      new DocumentModel({ _id: doc2Id, originalName: 'Paper Beta.pdf', status: 'ready', pageCount: 12 }),
    ];

    const fakeChunks = [
      { documentId: doc1Id, text: 'Alpha proposes supervised learning for NLP.', pageNumber: 1, chunkIndex: 0 },
      { documentId: doc2Id, text: 'Beta proposes unsupervised pretraining for vision.', pageNumber: 2, chunkIndex: 0 },
    ];

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue(fakeDocs as any);
    const chunkSpy = vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeChunks),
      }),
    } as any);

    // Simulate LLM returning fallback or degraded matrix
    const llmComparisonSpy = vi.spyOn(LLMService, 'generate').mockRejectedValue(
      new Error('LLM rate limit reached (429)')
    );

    const comparison = await ComparisonService.compareDocuments([doc1Id.toString(), doc2Id.toString()]);

    expect(comparison.degraded).toBe(true);
    expect(comparison.matrix.length).toBe(10);

    const standard10 = [
      'Research Objectives',
      'Methodologies',
      'Models and Technologies',
      'Datasets',
      'Evaluation Metrics',
      'Results',
      'Advantages',
      'Limitations',
      'Conclusions',
      'Research Gaps',
    ];

    for (const dim of standard10) {
      const match = comparison.matrix.find((m) => m.dimension.toLowerCase() === dim.toLowerCase());
      expect(match).toBeDefined();
      expect(match?.values.length).toBe(2);
    }

    docSpy.mockRestore();
    chunkSpy.mockRestore();
    llmComparisonSpy.mockRestore();
  });
});

describe('Phase 5: Research Sessions & Message Isolation', () => {
  it('prevents duplicate user messages on rapid retries or double submission', async () => {
    const docId = new Types.ObjectId();
    const sessionId = new Types.ObjectId();

    const fakeDoc = new DocumentModel({
      _id: docId,
      originalName: 'BERT.pdf',
      status: 'ready',
      chunkCount: 15,
    });

    const fakeSession = new ResearchSessionModel({
      _id: sessionId,
      title: 'BERT Query',
      selectedDocumentIds: [docId],
    });
    fakeSession.save = vi.fn().mockResolvedValue(fakeSession);

    const docSpy = vi.spyOn(DocumentModel, 'find').mockResolvedValue([fakeDoc] as any);
    const sessionSpy = vi.spyOn(ResearchSessionModel, 'findById').mockResolvedValue(fakeSession as any);
    const msgFindSpy = vi.spyOn(ChatMessageModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    // Simulate that the exact user message was already recorded as the last message
    const msgFindOneSpy = vi.spyOn(ChatMessageModel, 'findOne').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({
          role: 'user',
          content: 'What is masked language modeling?',
        }),
      }),
    } as any);

    const msgCreateSpy = vi.spyOn(ChatMessageModel, 'create').mockResolvedValue({} as any);

    const fakeEmbedder = { embedQuery: vi.fn().mockResolvedValue(new Array(384).fill(0.1)) };
    const embedSpy = vi.spyOn(await import('../services/ai/embeddingService.js'), 'getEmbeddingProvider').mockReturnValue(fakeEmbedder as any);

    const vectorSpy = vi.spyOn(await import('../services/ai/vectorStore.js').then((m) => m.VectorStore), 'search').mockResolvedValue([
      {
        chunk: {
          _id: new Types.ObjectId(),
          documentId: docId,
          text: 'Masked LM masks 15% of the input tokens at random.',
          pageNumber: 3,
        } as any,
        score: 0.95,
        denseScore: 0.95,
      },
    ]);

    const citeVerifierSpy = vi.spyOn(CitationVerifier, 'verifyAllClaims').mockResolvedValue([]);

    const llmSpy = vi.spyOn(LLMService, 'generate').mockResolvedValue(
      JSON.stringify({
        answer: 'Masked LM masks 15% of input tokens.',
        claims: [],
        hasInsufficientEvidence: false,
      })
    );

    await RAGService.ask({
      question: 'What is masked language modeling?',
      documentIds: [docId.toString()],
      sessionId: sessionId.toString(),
    });

    // ChatMessageModel.create should be called once for the assistant response, NOT twice (skipped duplicate user message)
    expect(msgCreateSpy).toHaveBeenCalledTimes(1);
    expect(msgCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'assistant',
        content: 'Masked LM masks 15% of input tokens.',
      })
    );

    docSpy.mockRestore();
    sessionSpy.mockRestore();
    msgFindSpy.mockRestore();
    msgFindOneSpy.mockRestore();
    msgCreateSpy.mockRestore();
    embedSpy.mockRestore();
    vectorSpy.mockRestore();
    citeVerifierSpy.mockRestore();
    llmSpy.mockRestore();
  });
});

describe('Phase 5: Security, Rate Limiting & Error Sanitization', () => {
  it('sanitizes stack traces, internal paths, and API keys in global error responses', () => {
    const rawError = new Error(
      'Mongoose connection failed at E:\\Multi document Research Assistant\\backend\\src\\config\\db.ts:45 with key AIzaSyFakeSecret1234'
    );

    const sanitized = sanitizeErrorMessage(rawError.message);
    expect(sanitized).not.toContain('E:\\');
    expect(sanitized).not.toContain('AIzaSyFakeSecret1234');
    expect(sanitized).not.toContain('db.ts');
  });

  it('enforces lightweight in-memory rate limiting and rejects requests exceeding threshold with 429', () => {
    const limiter = createRateLimiter({
      windowMs: 1000,
      max: 2,
      message: 'Too many requests.',
    });

    const mockReq: any = { ip: '127.0.0.1', headers: {} };
    const mockRes: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      setHeader: vi.fn(),
    };
    const nextFn = vi.fn();

    // 1st request -> OK
    limiter(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalledTimes(1);

    // 2nd request -> OK
    limiter(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalledTimes(2);

    // 3rd request -> 429 Rate Limit Exceeded
    limiter(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalledTimes(2);
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Rate Limit Exceeded',
      })
    );
  });
});
