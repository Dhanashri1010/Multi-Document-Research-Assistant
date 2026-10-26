import { describe, it, expect } from 'vitest';
import { chunkPages, estimateTokenCount } from '../services/documents/chunker.js';
import { cleanText } from '../services/documents/extractor.js';
import { cosineSimilarity } from '../services/ai/vectorStore.js';

describe('NLP & Text Processing', () => {
  it('cleanText correctly normalizes whitespace and removes control characters', () => {
    const raw = 'Hello\x00 World!\r\nThis is\ta   test.\n\n\n\nParagraph 2.';
    const cleaned = cleanText(raw);
    expect(cleaned).toBe('Hello World!\nThis is a test.\n\nParagraph 2.');
  });

  it('estimateTokenCount provides reasonable token estimates for academic text', () => {
    const text = 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.';
    const tokens = estimateTokenCount(text);
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(30);
  });

  it('chunkPages preserves page numbers and creates overlapping chunks', () => {
    const pages = [
      {
        pageNumber: 1,
        text: 'Abstract. We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism to draw global dependencies between input and output. The Transformer allows for significantly more parallelization. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.',
      },
      {
        pageNumber: 2,
        text: 'Model Architecture. Most competitive neural sequence transduction models have an encoder-decoder structure. Here, the encoder maps an input sequence of symbol representations to a sequence of continuous representations. Given z, the decoder then generates an output sequence of symbols one element at a time.',
      },
    ];

    const chunks = chunkPages(pages, {
      targetTokens: 30,
      overlapTokens: 10,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    // Page 1 chunks must have pageNumber === 1
    expect(chunks[0].pageNumber).toBe(1);
    // Chunks from page 2 must have pageNumber === 2
    const p2Chunk = chunks.find((c) => c.pageNumber === 2);
    expect(p2Chunk).toBeDefined();
    expect(p2Chunk?.text).toContain('Model Architecture');
  });
});

describe('Vector Retrieval & Similarity', () => {
  it('cosineSimilarity returns 1.0 for identical vectors', () => {
    const vecA = [0.5, 0.5, 0.5, 0.5];
    const vecB = [0.5, 0.5, 0.5, 0.5];
    const sim = cosineSimilarity(vecA, vecB);
    expect(sim).toBeCloseTo(1.0, 5);
  });

  it('cosineSimilarity returns 0 for orthogonal vectors', () => {
    const vecA = [1, 0, 0];
    const vecB = [0, 1, 0];
    const sim = cosineSimilarity(vecA, vecB);
    expect(sim).toBeCloseTo(0.0, 5);
  });

  it('cosineSimilarity handles unnormalized vectors and zero vectors safely', () => {
    const vecA = [2, 0, 0];
    const vecB = [5, 0, 0];
    const sim = cosineSimilarity(vecA, vecB);
    expect(sim).toBeCloseTo(1.0, 5);

    const zeroVec = [0, 0, 0];
    expect(cosineSimilarity(zeroVec, vecA)).toBe(0);
  });
});
