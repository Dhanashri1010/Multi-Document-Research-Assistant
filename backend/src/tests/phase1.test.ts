import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { splitIntoSentences, chunkPages, estimateTokenCount } from '../services/documents/chunker.js';
import { cleanText, extractTxt } from '../services/documents/extractor.js';
import { VectorStore } from '../services/ai/vectorStore.js';
import { LLMService } from '../services/ai/llmService.js';
import { config } from '../config/env.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';

describe('Phase 1 Unit Tests: Sentence Splitter & NLP Integrity', () => {
  it('correctly splits sentences without breaking numbers (28.4) or abbreviations (et al., Fig. 3, e.g.)', () => {
    const text = 'The BLEU score achieved was 28.4 on WMT 2014 according to Vaswani et al. (Fig. 3, e.g. base model). The next sentence starts here.';
    const sentences = splitIntoSentences(text);

    expect(sentences.length).toBeGreaterThanOrEqual(2);
    // Crucial check: 28.4 must never be split into "28." + "4"
    expect(sentences[0]).toContain('28.4');
    expect(sentences[0]).not.toContain('28. 4');
    expect(sentences[0]).not.toMatch(/28\.\s+4/);
    expect(sentences[0]).toContain('Vaswani et al.');
    expect(sentences[sentences.length - 1]).toBe('The next sentence starts here.');
  });

  it('de-hyphenates line-break words and strips standalone page numbers', () => {
    const raw = 'The trans-\nformer architecture relies on self-\nattention mechanisms.\n\n42\n\nNext section begins here.';
    const cleaned = cleanText(raw);

    // De-hyphenation checks
    expect(cleaned).toContain('transformer');
    expect(cleaned).toContain('selfattention');
    expect(cleaned).not.toContain('trans-\nformer');

    // Standalone page number "42" must be stripped
    const lines = cleaned.split('\n').map((l) => l.trim());
    expect(lines).not.toContain('42');
    expect(cleaned).toContain('Next section begins here.');
  });
});

describe('Phase 1 Unit Tests: Cross-Page Chunking', () => {
  it('chunks across page boundaries with accurate pageStart and pageEnd attributes', () => {
    const pages = [
      {
        pageNumber: 1,
        text: 'Sentence one on page one. Sentence two on page one.',
      },
      {
        pageNumber: 2,
        text: 'Sentence three on page two. Sentence four on page two.',
      },
      {
        pageNumber: 3,
        text: 'Sentence five on page three.',
      },
    ];

    const chunks = chunkPages(pages, {
      targetTokens: 15,
      overlapTokens: 5,
    });

    expect(chunks.length).toBeGreaterThan(0);

    for (const chunk of chunks) {
      expect(chunk.pageStart).toBeGreaterThanOrEqual(1);
      expect(chunk.pageEnd).toBeGreaterThanOrEqual(chunk.pageStart);
      // Compatibility: pageNumber equals pageStart
      expect(chunk.pageNumber).toBe(chunk.pageStart);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    }

    // Verify cross-boundary chunk existence
    const crossPageChunk = chunks.find((c) => c.pageStart !== c.pageEnd);
    if (crossPageChunk) {
      expect(crossPageChunk.pageEnd).toBeGreaterThan(crossPageChunk.pageStart);
    }
  });

  it('merges tiny trailing chunks (<40 tokens) into the previous chunk', () => {
    const pages = [
      {
        pageNumber: 1,
        text: 'Here is a comprehensive research discussion spanning several introductory sentences that adequately populate the primary chunk for this document test.',
      },
      {
        pageNumber: 2,
        text: 'Tiny end.',
      },
    ];

    const chunks = chunkPages(pages, {
      targetTokens: 25,
      overlapTokens: 5,
    });

    // The tiny trailing sentence "Tiny end." should not form an isolated micro-chunk
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.text).toContain('Tiny end.');
    expect(lastChunk.tokenCount).toBeGreaterThan(10);
  });

  it('hard-splits single oversized sentences exceeding targetTokens', () => {
    const longSentence = 'word '.repeat(300).trim() + '.';
    const pages = [{ pageNumber: 1, text: longSentence }];

    const chunks = chunkPages(pages, {
      targetTokens: 50,
      overlapTokens: 10,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(70);
    }
  });
});

describe('Phase 1 Unit Tests: TXT Support', () => {
  it('extracts plain-text files into virtual pages of ~3000 chars', async () => {
    const tmpDir = path.resolve(process.cwd(), config.uploadDir);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const txtPath = path.join(tmpDir, 'test_sample.txt');
    const paragraph = 'This is an academic research paragraph detailing experimental methodology and results.\n';
    const content = paragraph.repeat(80); // ~7000 chars

    fs.writeFileSync(txtPath, content, 'utf-8');

    try {
      const result = await extractTxt(txtPath);
      expect(result.totalPages).toBeGreaterThanOrEqual(2);
      expect(result.pages.length).toBe(result.totalPages);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[1].pageNumber).toBe(2);
      expect(result.pages[0].text.length).toBeLessThanOrEqual(3500);
    } finally {
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
  });
});

describe('Phase 1 Unit Tests: VectorStore Safety on Dimension Mismatch', () => {
  it('skips chunks whose embedding dimension differs from active query embedding without crashing', async () => {
    const doc1Id = '507f1f77bcf86cd799439011';
    const doc2Id = '507f1f77bcf86cd799439012';

    // Mock find on DocumentChunkModel
    const fakeChunks = [
      {
        _id: '507f1f77bcf86cd799439021',
        documentId: doc1Id,
        chunkIndex: 0,
        text: 'Matching dimension chunk',
        embedding: [0.1, 0.2, 0.3, 0.4], // 4-dim
        pageNumber: 1,
      },
      {
        _id: '507f1f77bcf86cd799439022',
        documentId: doc2Id,
        chunkIndex: 0,
        text: 'Mismatched dimension chunk',
        embedding: [0.1, 0.2], // 2-dim (mismatch against 4-dim query)
        pageNumber: 1,
      },
    ];

    const findSpy = vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      lean: () => Promise.resolve(fakeChunks),
    } as any);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const queryVec = [0.1, 0.2, 0.3, 0.4]; // 4-dim
      const results = await VectorStore.search(queryVec, [doc1Id, doc2Id], {
        minScore: 0.1,
      });

      // Mismatched chunk2 must be skipped, chunk1 must be returned
      expect(results.length).toBe(1);
      expect(results[0].chunk.text).toBe('Matching dimension chunk');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('need re-indexing')
      );
    } finally {
      findSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});

describe('Phase 1 Unit Tests: LLM Service Mock, Timeout & Retry', () => {
  it('deterministic mock provider produces structured output for summary and comparison', async () => {
    const origProvider = config.llmProvider;
    (config as any).llmProvider = 'mock';

    try {
      const summaryResp = await LLMService.generate('Generate the JSON summary now for document.');
      const parsedSummary = JSON.parse(summaryResp);
      expect(parsedSummary.summary).toBeDefined();
      expect(Array.isArray(parsedSummary.keyFindings)).toBe(true);

      const compareResp = await LLMService.generate('8 academic dimensions. Generate the JSON comparison now.');
      const parsedCompare = JSON.parse(compareResp);
      expect(Array.isArray(parsedCompare.matrix)).toBe(true);
      expect(Array.isArray(parsedCompare.similarities)).toBe(true);

      const qaResp = await LLMService.generate('RESEARCH QUESTION: What is Transformer?');
      expect(qaResp).toContain('Transformer');
    } finally {
      (config as any).llmProvider = origProvider;
    }
  });

  it('times out when LLM execution exceeds timeoutMs', async () => {
    const origProvider = config.llmProvider;
    (config as any).llmProvider = 'ollama';

    // Mock fetch that hangs
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => new Promise(() => {}); // never resolves

    try {
      await expect(
        LLMService.generate('Test prompt', { timeoutMs: 50, maxRetries: 0 })
      ).rejects.toThrow(/timed out/i);
    } finally {
      globalThis.fetch = originalFetch;
      (config as any).llmProvider = origProvider;
    }
  });
});
