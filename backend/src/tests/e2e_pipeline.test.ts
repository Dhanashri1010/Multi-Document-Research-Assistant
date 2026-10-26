import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { extractPdf } from '../services/documents/extractor.js';
import { chunkPages } from '../services/documents/chunker.js';
import { IngestionService } from '../services/documents/ingestionService.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { VectorStore } from '../services/ai/vectorStore.js';
import { getEmbeddingProvider } from '../services/ai/embeddingService.js';
import { RAGService } from '../services/ai/ragService.js';
import { LLMService } from '../services/ai/llmService.js';
import { config } from '../config/env.js';

import { checkMongoAvailability } from './mongo_helper.js';

describe('End-to-End Pipeline & Real Ingestion Verification', () => {
  // Resolve sample paths relative to the repository's /samples folder
  const sample1 = fs.existsSync(path.resolve(process.cwd(), 'samples', 'attention_is_all_you_need.pdf'))
    ? path.resolve(process.cwd(), 'samples', 'attention_is_all_you_need.pdf')
    : path.resolve(process.cwd(), '..', 'samples', 'attention_is_all_you_need.pdf');

  const sample2 = fs.existsSync(path.resolve(process.cwd(), 'samples', 'lora_low_rank_adaptation.pdf'))
    ? path.resolve(process.cwd(), 'samples', 'lora_low_rank_adaptation.pdf')
    : path.resolve(process.cwd(), '..', 'samples', 'lora_low_rank_adaptation.pdf');

  // Copy to upload directory so unlinking in cleanup does not delete original samples
  const uploadsDir = path.resolve(process.cwd(), config.uploadDir);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const paper1Path = path.join(uploadsDir, 'test_attention.pdf');
  const paper2Path = path.join(uploadsDir, 'test_lora.pdf');

  let doc1Id: string;
  let doc2Id: string;
  let isMongoReady = false;

  beforeAll(async () => {
    isMongoReady = await checkMongoAvailability();
    if (!isMongoReady) {
      console.warn('[e2e_pipeline.test] MongoDB unavailable. Skipping live DB pipeline tests.');
      return;
    }

    if (fs.existsSync(sample1)) fs.copyFileSync(sample1, paper1Path);
    if (fs.existsSync(sample2)) fs.copyFileSync(sample2, paper2Path);
    await mongoose.connect(config.mongoUri);
  }, 15000);

  afterAll(async () => {
    if (isMongoReady) {
      if (doc1Id) await IngestionService.deleteDocument(doc1Id);
      if (doc2Id) await IngestionService.deleteDocument(doc2Id);
      await mongoose.disconnect();
    }
  }, 15000);

  it('PDF Extractor accurately extracts multi-page text and preserves page numbers', async () => {
    const result = await extractPdf(paper1Path);
    expect(result.totalPages).toBe(3);
    expect(result.pages.length).toBe(3);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].text).toContain('Attention Is All You Need');
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].text).toContain('Scaled Dot-Product Attention');
    expect(result.pages[2].pageNumber).toBe(3);
    expect(result.pages[2].text).toContain('BLEU score');
  });

  it('Chunker chunks extracted pages and accurately attributes page metadata', async () => {
    const result = await extractPdf(paper1Path);
    const chunks = chunkPages(result.pages, { targetTokens: 100, overlapTokens: 20 });

    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(chunk.pageNumber).toBeGreaterThanOrEqual(1);
      expect(chunk.pageNumber).toBeLessThanOrEqual(3);
      expect(chunk.text.length).toBeGreaterThan(10);
    }
  });

  it('IngestionService indexes Paper 1 and Paper 2 with dense embeddings into MongoDB', async () => {
    if (!isMongoReady) return;

    // Create Document records
    const doc1 = await DocumentModel.create({
      filename: 'test_attention.pdf',
      originalName: 'Attention Is All You Need',
      fileSize: 1024 * 50,
      mimeType: 'application/pdf',
      filePath: paper1Path,
      status: 'uploaded',
    });
    doc1Id = doc1._id.toString();

    const doc2 = await DocumentModel.create({
      filename: 'test_lora.pdf',
      originalName: 'LoRA: Low-Rank Adaptation',
      fileSize: 1024 * 50,
      mimeType: 'application/pdf',
      filePath: paper2Path,
      status: 'uploaded',
    });
    doc2Id = doc2._id.toString();

    // Run ingestion
    await IngestionService.processDocument(doc1._id);
    await IngestionService.processDocument(doc2._id);

    // Verify status updated to 'ready'
    const updatedDoc1 = await DocumentModel.findById(doc1Id);
    const updatedDoc2 = await DocumentModel.findById(doc2Id);

    expect(updatedDoc1?.status).toBe('ready');
    expect(updatedDoc1?.pageCount).toBe(3);
    expect(updatedDoc1?.chunkCount).toBeGreaterThan(0);

    expect(updatedDoc2?.status).toBe('ready');
    expect(updatedDoc2?.pageCount).toBe(3);
    expect(updatedDoc2?.chunkCount).toBeGreaterThan(0);

    // Verify chunks exist in DocumentChunk collection
    const chunksDoc1 = await DocumentChunkModel.find({ documentId: doc1Id });
    expect(chunksDoc1.length).toBe(updatedDoc1!.chunkCount);
    expect(chunksDoc1[0].embedding.length).toBe(384); // all-MiniLM-L6-v2 dimension
  }, 45000);

  it('VectorStore retrieves relevant chunks based on semantic similarity', async () => {
    if (!isMongoReady) return;

    const embeddingProvider = getEmbeddingProvider();
    const query = 'What BLEU score was achieved on English-to-German translation?';
    const queryVector = await embeddingProvider.embedQuery(query);

    const results = await VectorStore.search(queryVector, [doc1Id, doc2Id], {
      topK: 3,
      minScore: 0.20,
      queryText: query,
    });

    expect(results.length).toBeGreaterThan(0);
    const topResult = results[0];
    expect(topResult.chunk.documentId.toString()).toBe(doc1Id);
    expect([2, 3]).toContain(topResult.chunk.pageNumber);
    expect(topResult.chunk.pageEnd).toBe(3);
    expect(topResult.chunk.text).toContain('BLEU score');
  }, 20000);

  it('VectorStore retrieves Low-Rank decomposition formula from Paper 2', async () => {
    if (!isMongoReady) return;

    const embeddingProvider = getEmbeddingProvider();
    const query = 'How does low-rank matrix decomposition update weights using matrices A and B?';
    const queryVector = await embeddingProvider.embedQuery(query);

    const results = await VectorStore.search(queryVector, [doc1Id, doc2Id], {
      topK: 3,
      minScore: 0.20,
      queryText: query,
    });

    expect(results.length).toBeGreaterThan(0);
    const topResult = results[0];
    expect(topResult.chunk.documentId.toString()).toBe(doc2Id);
    expect(topResult.chunk.text).toContain('Delta W');
  }, 20000);

  it('RAGService handles question across multiple papers and returns citations with page numbers', async () => {
    if (!isMongoReady) return;

    const llmSpy = vi.spyOn(LLMService, 'generate').mockResolvedValue(
      'Both LoRA and Transformer self-attention have limitations. [Attention Is All You Need, p. 2] discusses computational complexity.'
    );

    const query = 'What are the reported limitations in LoRA and Transformer self-attention?';
    const response = await RAGService.ask({
      question: query,
      documentIds: [doc1Id, doc2Id],
    });

    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.hasInsufficientEvidence).toBe(false);

    // Citations must reference actual documents and real page numbers
    for (const cite of response.citations) {
      expect(cite.documentName).toBeDefined();
      expect(cite.pageNumber).toBeGreaterThanOrEqual(1);
      expect(cite.pageNumber).toBeLessThanOrEqual(3);
      expect(cite.excerpt.length).toBeGreaterThan(10);
    }

    llmSpy.mockRestore();
  }, 20000);

  it('RAGService returns insufficient evidence when question has no basis in documents', async () => {
    if (!isMongoReady) return;

    const irrelevantQuery = 'What is the recipe for baking chocolate chip cookies?';
    const response = await RAGService.ask({
      question: irrelevantQuery,
      documentIds: [doc1Id, doc2Id],
    });

    // The similarity for chocolate cookies across transformer papers triggers insufficient evidence
    expect(response.hasInsufficientEvidence).toBe(true);
    expect(response.answer.toLowerCase()).toContain('sufficient evidence');
  }, 20000);
});
