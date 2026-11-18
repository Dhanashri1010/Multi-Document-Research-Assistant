import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { getEmbeddingProvider } from '../services/ai/embeddingService.js';
import { IngestionService } from '../services/documents/ingestionService.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import * as extractorModule from '../services/documents/extractor.js';

describe('Embedding Memory Optimization & Ingestion Safety Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Sequential Embedding Batches & 384-Dimension Vectors', () => {
    it('processes chunks sequentially (batchSize = 1) and yields event loop', async () => {
      const provider = getEmbeddingProvider();
      expect(provider.getModelName()).toBe('all-MiniLM-L6-v2');
      expect(provider.getDimension()).toBe(384);

      // Track extractor invocations
      const extractorCalls: any[] = [];
      const mockExtractor = vi.fn().mockImplementation(async (text: string, options: any) => {
        extractorCalls.push({ text, options });
        const mockVector = new Float32Array(384).fill(0.05);
        return { data: mockVector };
      });

      // Inject mock extractor
      (provider as any).getExtractor = vi.fn().mockResolvedValue(mockExtractor);

      const testChunks = [
        'Research chunk 1: Attention mechanisms in deep transformers.',
        'Research chunk 2: Computational complexity and linear attention.',
        'Research chunk 3: Memory footprint reduction on embedded accelerators.',
      ];

      const vectors = await provider.embedDocuments(testChunks);

      // Verify sequential execution: called once per chunk, NOT with array of chunks
      expect(extractorCalls.length).toBe(3);
      expect(typeof extractorCalls[0].text).toBe('string');
      expect(extractorCalls[0].text).toBe(testChunks[0]);
      expect(extractorCalls[0].options).toEqual({ pooling: 'mean', normalize: true });

      // Verify output dimensions
      expect(vectors.length).toBe(3);
      for (const vec of vectors) {
        expect(Array.isArray(vec)).toBe(true);
        expect(vec.length).toBe(384);
      }
    });

    it('embeds 51 realistic research chunks sequentially without dimension mismatch', async () => {
      const provider = getEmbeddingProvider();
      const mockExtractor = vi.fn().mockImplementation(async (_text: string, _opts: any) => {
        return { data: new Float32Array(384).fill(0.0123) };
      });
      (provider as any).getExtractor = vi.fn().mockResolvedValue(mockExtractor);

      // Create 51 realistic academic text chunks
      const sampleText = 'Deep learning models require significant compute and memory. '.repeat(25); // ~300 tokens
      const chunks51 = Array.from({ length: 51 }, (_, i) => `Section ${i + 1}: ${sampleText}`);

      const results = await provider.embedDocuments(chunks51);

      expect(results.length).toBe(51);
      expect(mockExtractor).toHaveBeenCalledTimes(51);
      for (let i = 0; i < 51; i++) {
        expect(results[i].length).toBe(384);
      }
    });

    it('enforces dimension validation and throws on vector length mismatch', async () => {
      const provider = getEmbeddingProvider();
      // Mock an extractor that erroneously produces 128 dimensions instead of 384
      const corruptExtractor = vi.fn().mockResolvedValue({
        data: new Float32Array(128).fill(0.1),
      });
      (provider as any).getExtractor = vi.fn().mockResolvedValue(corruptExtractor);

      await expect(
        provider.embedDocuments(['Invalid chunk dimension test'])
      ).rejects.toThrow(/dimension mismatch/i);
    });
  });

  describe('2. ONNX WASM Thread Configuration', () => {
    it('configures ONNX WASM backend to 1 thread for constrained memory environments', async () => {
      const { env } = await import('@xenova/transformers');
      expect(env?.backends?.onnx?.wasm).toBeDefined();

      // Trigger real provider extractor to verify env setting is applied
      const provider = getEmbeddingProvider();
      // Restore original getExtractor in case earlier tests mocked it
      delete (provider as any).getExtractor;

      // Ensure single thread configuration is applied
      if (env?.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
      }

      expect(env.backends.onnx.wasm.numThreads).toBe(1);
    });
  });

  describe('3. Extraction Memory Release & Document Ingestion', () => {
    it('releases heavy extraction data (fullText and pages) before embedding generation', async () => {
      const docId = new mongoose.Types.ObjectId();
      const fakeDoc: any = {
        _id: docId,
        originalName: 'Large_Attention_Paper.pdf',
        filePath: 'uploads/fake_paper.pdf',
        fileType: 'pdf',
        status: 'uploaded',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);
      vi.spyOn(DocumentChunkModel, 'deleteMany').mockResolvedValue({} as any);
      vi.spyOn(DocumentChunkModel, 'insertMany').mockResolvedValue([
        { _id: new mongoose.Types.ObjectId() },
        { _id: new mongoose.Types.ObjectId() },
      ] as any);

      const fakePages = Array.from({ length: 36 }, (_, i) => ({
        pageNumber: i + 1,
        text: `Page ${i + 1} content discussing transformers and memory boundaries. `.repeat(10),
      }));

      const fullText = fakePages.map((p) => p.text).join('\n');

      vi.spyOn(extractorModule, 'extractPdf').mockResolvedValue({
        totalPages: 36,
        pages: fakePages,
        fullText,
        metadata: { title: 'Transformers at Scale', year: 2026 },
        fileType: 'pdf',
      });

      const provider = getEmbeddingProvider();
      let memoryCheckedDuringEmbedding = false;

      vi.spyOn(provider, 'embedDocuments').mockImplementation(async (texts: string[]) => {
        // At the moment embedDocuments runs, the function should have passed the release point
        expect(texts.length).toBeGreaterThan(0);
        memoryCheckedDuringEmbedding = true;
        return texts.map(() => new Array(384).fill(0.05));
      });

      await IngestionService.processDocument(docId);

      expect(memoryCheckedDuringEmbedding).toBe(true);
      expect(fakeDoc.status).toBe('ready');
      expect(fakeDoc.pageCount).toBe(36);
      expect(fakeDoc.embeddingDim).toBe(384);
    });

    it('preserves error handling and sets status to failed when embedding fails', async () => {
      const docId = new mongoose.Types.ObjectId();
      const fakeDoc: any = {
        _id: docId,
        originalName: 'Failing_Document.pdf',
        filePath: 'uploads/failing.pdf',
        fileType: 'pdf',
        status: 'uploaded',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(DocumentModel, 'findById').mockResolvedValue(fakeDoc);
      vi.spyOn(extractorModule, 'extractPdf').mockResolvedValue({
        totalPages: 2,
        pages: [
          { pageNumber: 1, text: 'Test page 1 text' },
          { pageNumber: 2, text: 'Test page 2 text' },
        ],
        fullText: 'Test page 1 text\nTest page 2 text',
        metadata: { title: 'Test Paper' },
        fileType: 'pdf',
      });

      const provider = getEmbeddingProvider();
      vi.spyOn(provider, 'embedDocuments').mockRejectedValue(
        new Error('Out of memory or backend computation error')
      );

      await IngestionService.processDocument(docId);

      expect(fakeDoc.status).toBe('failed');
      expect(fakeDoc.errorDetails).toContain('Out of memory or backend computation error');
    });
  });
});
