import { describe, it, expect } from 'vitest';
import {
  CitationVerifier,
  cleanExcerpt,
  extractNumbersAndCodes,
  extractSalientTokens,
} from '../services/ai/citationVerifier.js';

describe('Part 2: Citation Quality & Hybrid Verification', () => {
  describe('1. Clean Excerpt & Preprocessing', () => {
    it('strips running headers, footers, and repairs hyphenations', () => {
      const garbled = 'arXiv:2301.12345v1\nThis is a trans-\nformer model developed for natural language processing.\nPage 1 of 12';
      const cleaned = cleanExcerpt(garbled);
      expect(cleaned).toContain('transformer model');
      expect(cleaned).not.toContain('arXiv:2301.12345v1');
      expect(cleaned).not.toContain('Page 1 of 12');
    });

    it('extracts numbers and percentages accurately while ignoring citations and section labels', () => {
      const text = 'The proposed model achieved 88.5% accuracy on GLUE and 92.1 F1 score [Vaswani et al., p. 4].';
      const numbers = extractNumbersAndCodes(text);
      expect(numbers).toContain('88.5%');
      expect(numbers).toContain('92.1');
      expect(numbers).not.toContain('4'); // Ignores page number [p. 4]
    });
  });

  describe('2. Hybrid Claim Scoring Formula', () => {
    // Formula: 0.35 * containment + 0.35 * TF-IDF cosine + 0.15 * entity/number match + 0.15 * embedding sim
    it('classifies high-overlap sentence as verified (score >= 0.70)', async () => {
      const claim = 'The Transformer architecture relies entirely on self-attention mechanisms without recurrence.';
      const chunk = 'The Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or recurrence.';
      
      const res = await CitationVerifier.verifyClaimAgainstChunk(claim, chunk);
      expect(res.status).toBe('verified');
      expect(res.isSupported).toBe(true);
      expect(res.supportScore).toBeGreaterThanOrEqual(0.70);
    });

    it('classifies conceptual overlap without identical wording as partially supported (0.40 - 0.70)', async () => {
      const claim = 'Machine translation models require less training time across distributed GPU hardware.';
      const chunk = 'Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable and requiring significantly less time to train.';
      
      const res = await CitationVerifier.verifyClaimAgainstChunk(claim, chunk);
      expect(res.status).toBe('partially_supported');
      expect(res.isSupported).toBe(true);
      expect(res.supportScore).toBeGreaterThanOrEqual(0.35);
    });

    it('penalizes hallucinated metrics and classifies as unsupported (< 0.40)', async () => {
      const claim = 'The network achieved 99.4% top-1 accuracy on ImageNet classification.';
      const chunk = 'The 152-layer ResNet achieves 3.57% top-5 error on the ImageNet test set and 75.3% top-1 accuracy.';
      
      const res = await CitationVerifier.verifyClaimAgainstChunk(claim, chunk);
      expect(res.status).toBe('unsupported');
      expect(res.isSupported).toBe(false);
      expect(res.supportScore).toBeLessThan(0.40);
      expect(res.missingNumbers).toContain('99.4%');
    });

    it('classifies completely irrelevant text as unsupported (< 0.40)', async () => {
      const claim = 'Quantum annealers utilize superconductive qubits operating near absolute zero.';
      const chunk = 'Convolutional neural networks extract hierarchical spatial representations using 3x3 receptive fields.';
      
      const res = await CitationVerifier.verifyClaimAgainstChunk(claim, chunk);
      expect(res.status).toBe('unsupported');
      expect(res.isSupported).toBe(false);
      expect(res.supportScore).toBeLessThan(0.40);
    });
  });

  describe('3. Cross-Passage Verification & Zero "Not Checked" State', () => {
    it('cross-verifies across other passages if cited passage does not contain evidence', async () => {
      const claims = [
        {
          claim: 'BERT introduces masked language modeling for bidirectional pretraining.',
          sourceIndices: [1], // Chunk 1 does not mention it, but chunk 2 does!
        },
      ];

      const chunks = [
        {
          index: 1,
          text: 'Residual learning frameworks ease the training of networks that are substantially deeper than those used previously.',
        },
        {
          index: 2,
          text: 'We introduce BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers using masked language modeling.',
        },
      ];

      const results = await CitationVerifier.verifyAllClaims(claims, chunks);
      expect(results).toHaveLength(1);
      const claimResult = results[0];
      
      // Successfully re-attributed to chunk 2
      expect(claimResult.verifiedIndices).toContain(2);
      expect(claimResult.status).toBe('verified');
      expect(claimResult.confidence).toBe('high');
      expect(claimResult.chunkDetails?.[2]?.status).toBe('verified');
    });

    it('guarantees every claim produces a definitive 3-state status with no unverified leaks', async () => {
      const claims = [
        { claim: 'Transformers use self-attention.', sourceIndices: [1] },
        { claim: 'Superconductors levitate magnetic trains.', sourceIndices: [1] },
      ];

      const chunks = [
        {
          index: 1,
          text: 'The Transformer model is based solely on self-attention mechanisms to compute representations.',
        },
      ];

      const results = await CitationVerifier.verifyAllClaims(claims, chunks);
      expect(results[0].status).toBe('verified');
      expect(results[1].status).toBe('unsupported');
      expect(results[0].confidence).toBe('high');
      expect(results[1].confidence).toBe('low');
    });
  });
});
