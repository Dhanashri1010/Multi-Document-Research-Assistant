import { describe, it, expect } from 'vitest';
import {
  isBroadDocumentQuery,
  isComparativeQuery,
  checkLexicalOverlap,
  calculateAdaptiveThreshold,
  formatInsufficientEvidenceMessage,
} from '../services/ai/ragService.js';

describe('Small Document Adaptive Retrieval & Gate Rules', () => {
  describe('isBroadDocumentQuery', () => {
    it('accurately identifies document-level summary and broad conceptual queries', () => {
      const broadQueries = [
        'What are the main concepts discussed in this document?',
        'Summarize this document.',
        'Please give me an overview of this paper.',
        'What is this document about?',
        'What does this paper discuss?',
        'What are the key points in this document?',
        'What are the main findings?',
        'Explain this document in simple terms.',
        'Describe this document.',
        'High-level summary of this document',
      ];

      for (const q of broadQueries) {
        expect(isBroadDocumentQuery(q), `Expected "${q}" to be classified as broad`).toBe(true);
      }
    });

    it('rejects specific and out-of-domain queries', () => {
      const specificQueries = [
        'What is cosine similarity?',
        'What is the current market price of a GPU?',
        'How does backpropagation compute gradients?',
        'What BLEU score did the model achieve?',
        'What was the training batch size?',
      ];

      for (const q of specificQueries) {
        expect(isBroadDocumentQuery(q), `Expected "${q}" to NOT be classified as broad`).toBe(false);
      }
    });
  });

  describe('isComparativeQuery', () => {
    it('detects cross-document and comparative queries', () => {
      expect(isComparativeQuery('Compare these two papers on retrieval')).toBe(true);
      expect(isComparativeQuery('How do vector databases compare with keyword search?')).toBe(true);
      expect(isComparativeQuery('Across all these documents, what are the key differences?')).toBe(true);
      expect(isComparativeQuery('What are the differences between both papers?')).toBe(true);
    });

    it('rejects single-document non-comparative queries', () => {
      expect(isComparativeQuery('What is cosine similarity?')).toBe(false);
      expect(isComparativeQuery('What are the main concepts discussed in this document?')).toBe(false);
    });
  });

  describe('checkLexicalOverlap', () => {
    const chunks = [
      { text: 'A vector database stores numerical embeddings. Cosine similarity measures the angle between vectors.' },
      { text: 'Retrieval-Augmented Generation (RAG) combines information retrieval with language models.' },
    ];

    it('returns true when query terms match chunk content', () => {
      expect(checkLexicalOverlap('What is cosine similarity?', chunks)).toBe(true);
      expect(checkLexicalOverlap('How does RAG work?', chunks)).toBe(true);
    });

    it('returns false when no non-stopwords match chunk content', () => {
      expect(checkLexicalOverlap('What is the current market price of a GPU?', chunks)).toBe(false);
      expect(checkLexicalOverlap('Where can I buy an airplane ticket to Tokyo?', chunks)).toBe(false);
    });
  });

  describe('calculateAdaptiveThreshold', () => {
    it('uses relaxed threshold (0.15) for broad document queries on small documents (<= 5 chunks)', () => {
      const result = calculateAdaptiveThreshold({
        baseThreshold: 0.28,
        totalAvailableChunks: 4,
        isBroadQuery: true,
        hasLexicalMatch: false,
        bestDenseSimilarity: 0.22,
      });

      expect(result.threshold).toBe(0.15);
      expect(result.isSufficient).toBe(true);
    });

    it('uses lexical-aware threshold (0.18) for specific queries with keyword match on small documents', () => {
      const result = calculateAdaptiveThreshold({
        baseThreshold: 0.28,
        totalAvailableChunks: 3,
        isBroadQuery: false,
        hasLexicalMatch: true,
        bestDenseSimilarity: 0.20,
      });

      expect(result.threshold).toBe(0.18);
      expect(result.isSufficient).toBe(true);
    });

    it('strictly refuses out-of-domain queries with no lexical overlap and low similarity on small documents', () => {
      const result = calculateAdaptiveThreshold({
        baseThreshold: 0.28,
        totalAvailableChunks: 4,
        isBroadQuery: false,
        hasLexicalMatch: false,
        bestDenseSimilarity: 0.08,
      });

      expect(result.threshold).toBe(0.22);
      expect(result.isSufficient).toBe(false);
    });

    it('preserves calibrated base threshold (0.28) on standard/large documents (> 5 chunks)', () => {
      const resultSufficient = calculateAdaptiveThreshold({
        baseThreshold: 0.28,
        totalAvailableChunks: 30,
        isBroadQuery: false,
        hasLexicalMatch: false,
        bestDenseSimilarity: 0.31,
      });
      expect(resultSufficient.threshold).toBe(0.28);
      expect(resultSufficient.isSufficient).toBe(true);

      const resultInsufficient = calculateAdaptiveThreshold({
        baseThreshold: 0.28,
        totalAvailableChunks: 30,
        isBroadQuery: false,
        hasLexicalMatch: false,
        bestDenseSimilarity: 0.24,
      });
      expect(resultInsufficient.threshold).toBe(0.28);
      expect(resultInsufficient.isSufficient).toBe(false);
    });
  });

  describe('formatInsufficientEvidenceMessage', () => {
    it('produces clean, professional message without exposing raw percentages or threshold metrics', () => {
      const singleDocMsg = formatInsufficientEvidenceMessage(1, 'Sample_Research_1_RAG_Systems.pdf');
      expect(singleDocMsg).toContain('Sample_Research_1_RAG_Systems.pdf');
      expect(singleDocMsg).not.toContain('%');
      expect(singleDocMsg).not.toContain('threshold');
      expect(singleDocMsg).not.toContain('semantic relevance');

      const multiDocMsg = formatInsufficientEvidenceMessage(3);
      expect(multiDocMsg).toContain('selected research documents');
      expect(multiDocMsg).not.toContain('%');
      expect(multiDocMsg).not.toContain('threshold');
    });
  });
});
