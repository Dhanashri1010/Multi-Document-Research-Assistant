import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { BM25Index, tokenizeText, stemToken } from '../services/ai/bm25.js';
import {
  cosineSimilarityTyped,
  maximalMarginalRelevance,
  invalidateVectorCache,
} from '../services/ai/vectorStore.js';
import { detectSectionHeading, chunkPages } from '../services/documents/chunker.js';
import { extractPage1Metadata, extractPdf } from '../services/documents/extractor.js';
import { RAGService } from '../services/ai/ragService.js';
import { LLMService } from '../services/ai/llmService.js';
import { IDocumentChunk } from '../models/DocumentChunk.js';
import { config } from '../config/env.js';

describe('Phase 2: BM25 Lexical Ranking Engine', () => {
  it('tokenizes, strips stopwords, and stems English tokens', () => {
    const text = 'The transformers are attending to recurrent connections in neural networks.';
    const tokens = tokenizeText(text);

    // Stopwords like 'the', 'are', 'to', 'in' must be removed
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('are');
    expect(tokens).not.toContain('to');
    expect(tokens).not.toContain('in');

    // Stemmed tokens
    expect(tokens).toContain('transform');
    expect(tokens).toContain('attend');
    expect(tokens).toContain('network');
  });

  it('ranks documents correctly based on term frequency and inverse document frequency', () => {
    const docs = [
      { id: 'doc1', text: 'Attention is all you need for sequence to sequence transduction models.' },
      { id: 'doc2', text: 'Convolutional neural networks for visual recognition and image processing.' },
      { id: 'doc3', text: 'Recurrent models typically factor computation along the symbol positions of input sequences.' },
    ];

    const bm25 = new BM25Index(docs);
    const results = bm25.search('attention models');

    expect(results.length).toBeGreaterThanOrEqual(1);
    // doc1 contains both 'attention' and 'models', so it should rank first
    expect(results[0].id).toBe('doc1');
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('returns empty results when query contains no matching terms', () => {
    const docs = [{ id: 'doc1', text: 'Deep learning with PyTorch' }];
    const bm25 = new BM25Index(docs);
    const results = bm25.search('quantum computing algorithms');
    expect(results).toEqual([]);
  });
});

describe('Phase 2: Maximal Marginal Relevance (MMR) & Vector Similarity', () => {
  it('computes accurate cosine similarity between Float32Array vectors', () => {
    const vecA = new Float32Array([1.0, 0.0, 0.0]);
    const vecB = new Float32Array([1.0, 0.0, 0.0]);
    const vecC = new Float32Array([0.0, 1.0, 0.0]);

    expect(cosineSimilarityTyped(vecA, vecB)).toBeCloseTo(1.0, 5);
    expect(cosineSimilarityTyped(vecA, vecC)).toBeCloseTo(0.0, 5);
  });

  it('penalizes redundant, nearly identical chunks to guarantee diversity', () => {
    // Query vector: [1, 0, 0]
    // Candidate 1: relevance 0.95, vector: [1, 0, 0]
    // Candidate 2 (redundant clone of 1): relevance 0.94, vector: [0.999, 0.01, 0] (sim with 1 ~ 0.999)
    // Candidate 3 (diverse new info): relevance 0.85, vector: [0.5, 0.866, 0] (sim with 1 ~ 0.5)

    const cand1 = {
      chunk: { _id: 'c1', text: 'Transformer self-attention details' } as unknown as IDocumentChunk,
      vector: new Float32Array([1.0, 0.0, 0.0]),
      score: 0.95,
      denseScore: 0.95,
    };
    const cand2 = {
      chunk: { _id: 'c2', text: 'Transformer self-attention details copy' } as unknown as IDocumentChunk,
      vector: new Float32Array([0.999, 0.01, 0.0]),
      score: 0.94,
      denseScore: 0.94,
    };
    const cand3 = {
      chunk: { _id: 'c3', text: 'Training hardware and optimizer setup' } as unknown as IDocumentChunk,
      vector: new Float32Array([0.5, 0.866, 0.0]),
      score: 0.85,
      denseScore: 0.85,
    };

    // Asking for top 2 diverse chunks:
    // With lambda=0.7:
    // Pick 1: cand1 (score 0.95)
    // For pick 2:
    // cand2: 0.7 * 0.94 - 0.3 * 0.999 = 0.658 - 0.2997 = 0.3583
    // cand3: 0.7 * 0.85 - 0.3 * 0.500 = 0.595 - 0.1500 = 0.4450 -> cand3 wins!
    const selected = maximalMarginalRelevance([cand1, cand2, cand3], 2, 0.7);

    expect(selected.length).toBe(2);
    expect(selected[0].chunk._id).toBe('c1');
    expect(selected[1].chunk._id).toBe('c3'); // cand3 chosen over redundant cand2!
  });
});

describe('Phase 2: Section Heading Detection & References Awareness', () => {
  it('detects standard academic section headings correctly', () => {
    expect(detectSectionHeading('Abstract')).toBe('Abstract');
    expect(detectSectionHeading('1 Introduction')).toBe('Introduction');
    expect(detectSectionHeading('1. Introduction')).toBe('Introduction');
    expect(detectSectionHeading('2 Related Work')).toBe('Background');
    expect(detectSectionHeading('3 Model Architecture')).toBe('Methodology');
    expect(detectSectionHeading('4 Experiments and Evaluation')).toBe('Experiments');
    expect(detectSectionHeading('5 Results')).toBe('Results');
    expect(detectSectionHeading('6 Discussion')).toBe('Discussion');
    expect(detectSectionHeading('7 Conclusion')).toBe('Conclusion');
    expect(detectSectionHeading('References')).toBe('References');
    expect(detectSectionHeading('Bibliography')).toBe('References');
    expect(detectSectionHeading('Appendix A. Mathematical Proofs')).toBe('Appendix');

    // Normal sentences should return null
    expect(detectSectionHeading('This is just a normal sentence discussing model architecture.')).toBeNull();
  });

  it('assigns section headings and constructs contextual embeddingText in chunkPages', () => {
    const pages = [
      {
        pageNumber: 1,
        text: 'Abstract\nWe propose the Transformer model.\n\n1 Introduction\nSequential models have been dominant.',
      },
      {
        pageNumber: 2,
        text: 'References\n[1] Vaswani et al. Attention is all you need.',
      },
    ];

    const chunks = chunkPages(pages, {
      targetTokens: 30,
      overlapTokens: 5,
      docTitle: 'Attention Paper',
    });

    expect(chunks.length).toBeGreaterThan(0);
    // Chunks should have section assigned
    const abstractChunk = chunks.find((c) => c.text.includes('Transformer model'));
    expect(abstractChunk).toBeDefined();
    expect(abstractChunk?.embeddingText).toContain('Attention Paper | Abstract:');

    const refChunk = chunks.find((c) => c.text.includes('Attention is all you need'));
    expect(refChunk).toBeDefined();
    expect(refChunk?.section).toBe('References');
    expect(refChunk?.embeddingText).toContain('Attention Paper | References:');
  });
});

describe('Phase 2: Page 1 Metadata Extraction & Deduplication', () => {
  it('extracts paper title, authors, year, and abstract from page 1 text', () => {
    const page1 = `Attention Is All You Need
Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit
Google Brain, Google Research
{avaswani, noam}@google.com
arXiv:1706.03762v5 [cs.CL] 6 Dec 2017

Abstract
The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer based solely on attention mechanisms.

1 Introduction
Recurrent neural networks have been firmly established as state of the art.`;

    const meta = extractPage1Metadata(page1);

    expect(meta.title).toBe('Attention Is All You Need');
    expect(meta.authors).toBeDefined();
    expect(meta.authors).toContain('Ashish Vaswani');
    expect(meta.authors).toContain('Noam Shazeer');
    expect(meta.year).toBe(2017);
    expect(meta.abstract).toContain('The dominant sequence transduction models');
    expect(meta.abstract).not.toContain('1 Introduction');
  });

  it('detects and strips references section when stripReferences is true', () => {
    const pages = [
      {
        pageNumber: 1,
        text: 'Abstract\nNovel neural architecture.\n\n3 Methodology\nModel parameters.\n\nReferences\n[1] Smith et al. Deep Learning, 2020.\n[2] Doe et al. Transformers, 2021.',
      },
    ];

    const chunks = chunkPages(pages, {
      stripReferences: true,
      docTitle: 'Test Paper',
    });

    for (const chunk of chunks) {
      expect(chunk.section).not.toBe('References');
      expect(chunk.text).not.toContain('Smith et al. Deep Learning');
    }
  });

  it('rejects corrupt files that lack %PDF- magic bytes with clear error', async () => {
    const uploadDir = path.resolve(process.cwd(), config.uploadDir);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const fakePdfPath = path.join(uploadDir, 'corrupt_test.pdf');
    fs.writeFileSync(fakePdfPath, 'NOT_A_REAL_PDF_CONTENT_HERE_AT_ALL', 'utf-8');

    try {
      await expect(extractPdf(fakePdfPath)).rejects.toThrow(/Invalid PDF format/i);
    } finally {
      if (fs.existsSync(fakePdfPath)) fs.unlinkSync(fakePdfPath);
    }
  });

  it('computes consistent SHA-256 hash for document deduplication', () => {
    const buffer1 = Buffer.from('Attention Is All You Need PDF Content');
    const buffer2 = Buffer.from('Attention Is All You Need PDF Content');
    const buffer3 = Buffer.from('Different Document Content');

    const hash1 = crypto.createHash('sha256').update(buffer1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(buffer2).digest('hex');
    const hash3 = crypto.createHash('sha256').update(buffer3).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1.length).toBe(64);
  });
});

describe('Phase 2: Conversational Question Rewriter', () => {
  it('rewrites follow-up questions into standalone queries using dialogue history', async () => {
    const history = [
      { role: 'user', content: 'What is LoRA?' },
      { role: 'assistant', content: 'LoRA (Low-Rank Adaptation) freezes pretrained model weights and injects trainable rank decomposition matrices.' },
    ];

    const generateSpy = vi.spyOn(LLMService, 'generate').mockResolvedValueOnce(
      'What are the memory and parameter benefits of Low-Rank Adaptation (LoRA)?'
    );

    const rewritten = await RAGService.rewriteQuery('What are its parameter benefits?', history);

    expect(generateSpy).toHaveBeenCalled();
    expect(rewritten).toBe('What are the memory and parameter benefits of Low-Rank Adaptation (LoRA)?');

    generateSpy.mockRestore();
  });

  it('returns original question unchanged if history is empty', async () => {
    const question = 'What is the BLEU score of the Transformer?';
    const rewritten = await RAGService.rewriteQuery(question, []);
    expect(rewritten).toBe(question);
  });
});
