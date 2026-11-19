import { describe, it, expect, vi } from 'vitest';
import {
  ragQaPromptV1,
  ragQaPromptV2,
  documentSummaryPromptV2,
  comparisonMatrixPromptV2,
  entityExtractionPromptV1,
  topicNamingPromptV1,
  crossLingualQaPromptV1,
  literatureReviewPromptV1,
} from '../prompts/index.js';
import { NlpLiteratureReviewService } from '../services/nlp/nlpLiteratureReviewService.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';

vi.mock('../models/NlpCache.js', () => ({
  NlpCacheService: {
    findOne: vi.fn().mockResolvedValue(null),
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
  },
  computeHash: vi.fn((obj: any) => JSON.stringify(obj).slice(0, 16)),
}));

describe('CO4: Prompt Engineering Library (Versioned Templates & Rationales)', () => {
  const prompts = [
    ragQaPromptV1,
    ragQaPromptV2,
    documentSummaryPromptV2,
    comparisonMatrixPromptV2,
    entityExtractionPromptV1,
    topicNamingPromptV1,
    crossLingualQaPromptV1,
    literatureReviewPromptV1,
  ];

  it('contains all 8 required versioned prompts with comprehensive metadata', () => {
    expect(prompts).toHaveLength(8);

    for (const p of prompts) {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(p.author).toBeDefined();
      expect(p.purpose).toBeDefined();
      expect(['zero-shot', 'few-shot', 'chain-of-thought', 'structured-json']).toContain(p.strategy);
      expect(p.rationale.length).toBeGreaterThan(20);
      expect(p.variables.length).toBeGreaterThan(0);
      expect(typeof p.formatPrompt).toBe('function');
    }
  });

  it('correctly interpolates variables into RAG QA V2 prompt', () => {
    const formatted = ragQaPromptV2.formatPrompt({
      context: 'Sample excerpt text [Paper 1, Page 2]',
      question: 'What is the finding?',
    });
    expect(formatted).toContain('Sample excerpt text [Paper 1, Page 2]');
    expect(formatted).toContain('What is the finding?');
    expect(formatted).toContain('EVIDENCE IDENTIFICATION:');
  });

  it('correctly interpolates variables into Literature Review prompt', () => {
    const formatted = literatureReviewPromptV1.formatPrompt({
      paperList: '1. Paper Alpha\n2. Paper Beta',
      paperExcerpts: 'Excerpts from both papers',
    });
    expect(formatted).toContain('Paper Alpha');
    expect(formatted).toContain('1. Unified Background & Research Problem');
    expect(formatted).toContain('3. Diverging Findings & Contradictions');
  });
});

describe('CO4: Multi-Document Literature Review Generator', () => {
  it('throws an error if fewer than 2 documents are selected', async () => {
    await expect(
      NlpLiteratureReviewService.generateReview({ documentIds: ['doc1'] })
    ).rejects.toThrow(/requires selecting at least 2 research papers/);
  });

  it('throws an error if more than 5 documents are selected', async () => {
    await expect(
      NlpLiteratureReviewService.generateReview({
        documentIds: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
      })
    ).rejects.toThrow(/maximum of 5 papers/);
  });

  it('generates a synthesized 5-section literature review with citations', async () => {
    vi.spyOn(DocumentModel, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { _id: 'docA', title: 'Dense Retrieval Foundations', originalName: 'paperA.pdf' },
        { _id: 'docB', title: 'Sparse BM25 Evaluation', originalName: 'paperB.pdf' },
      ]),
    } as any);

    vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue([
            { chunkIndex: 1, pageNumber: 2, text: 'Dense embeddings map query and passage into 768d space.' },
          ]),
        }),
      }),
    } as any);

    const review = await NlpLiteratureReviewService.generateReview({
      documentIds: ['docA', 'docB'],
    });

    expect(review.papersIncluded).toHaveLength(2);
    expect(review.reviewMarkdown).toContain('1. Unified Background');
    expect(review.reviewMarkdown).toContain('2. Synthesis of Common Methodologies');
    expect(review.reviewMarkdown).toContain('3. Diverging Findings & Contradictions');
    expect(review.reviewMarkdown).toContain('4. Open Research Gaps');
    expect(review.reviewMarkdown).toContain('5. Suggested Follow-Up Research Questions');
    expect(review.reviewMarkdown).toContain('Dense Retrieval Foundations');
  });
});
