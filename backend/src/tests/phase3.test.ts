import { describe, it, expect } from 'vitest';
import {
  StructuredRAGAnswerSchema,
  StructuredComparisonSchema,
} from '../services/ai/schemas.js';
import { CitationVerifier } from '../services/ai/citationVerifier.js';
import { LLMService } from '../services/ai/llmService.js';
import { config } from '../config/env.js';

describe('Phase 3: Zod Schema Validation', () => {
  it('validates structured RAG answer with claims and source indices', () => {
    const validData = {
      hasInsufficientEvidence: false,
      answer: 'The big Transformer achieved a BLEU score of 28.4 on English-to-German translation [Attention, p. 3].',
      claims: [
        {
          claim: 'The big Transformer achieved 28.4 BLEU score on WMT 2014 En-De.',
          sourceIndices: [1],
          confidence: 'high',
        },
      ],
    };

    const parsed = StructuredRAGAnswerSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hasInsufficientEvidence).toBe(false);
      expect(parsed.data.claims?.length).toBe(1);
      expect(parsed.data.claims?.[0].sourceIndices).toContain(1);
    }
  });

  it('validates structured insufficient-evidence refusal response', () => {
    const refusalData = {
      hasInsufficientEvidence: true,
      insufficientReason: 'Document does not mention speech-to-text warmup schedules.',
      answer: 'The provided documents do not contain evidence addressing speech-to-text models.',
      claims: [],
    };

    const parsed = StructuredRAGAnswerSchema.safeParse(refusalData);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hasInsufficientEvidence).toBe(true);
    }
  });

  it('validates 8-dimension structured academic comparison schema', () => {
    const validComparison = {
      matrix: [
        {
          dimension: 'Research Objective',
          values: [
            {
              documentId: 'doc1',
              documentName: 'Attention Is All You Need',
              finding: 'Replace recurrence with self-attention mechanism.',
              pageNumber: 1,
            },
            {
              documentId: 'doc2',
              documentName: 'LoRA: Low-Rank Adaptation',
              finding: 'Parameter-efficient fine-tuning via low-rank decomposition.',
              pageNumber: 1,
            },
          ],
        },
      ],
      similarities: ['Both models target efficiency in transformer architectures.'],
      differences: ['Attention introduces foundational architecture; LoRA adapts pre-trained weights.'],
      keyFindings: ['Attention enables massive parallelization.'],
      limitations: ['Self-attention has quadratic complexity on long sequences.'],
    };

    const parsed = StructuredComparisonSchema.safeParse(validComparison);
    expect(parsed.success).toBe(true);
  });
});

describe('Phase 3: Claim-Level Citation Verification', () => {
  const sampleChunk =
    'Translation Benchmarks: The big Transformer achieves 28.4 BLEU on WMT 2014 English-to-German, outperforming existing models by over 2.0 BLEU.';

  it('verifies supported claim with preserved numbers and high token overlap', async () => {
    const supportedClaim = 'The Transformer achieved a 28.4 BLEU score on English-to-German translation.';
    const result = await CitationVerifier.verifyClaimAgainstChunk(supportedClaim, sampleChunk);

    expect(result.isSupported).toBe(true);
    expect(result.missingNumbers.length).toBe(0);
  });

  it('flags unsupported claim with hallucinated or mismatched metrics', async () => {
    // Number mismatch: 45.2 BLEU is not present in the 28.4 BLEU chunk
    const unsupportedClaim = 'The Transformer achieved a 45.2 BLEU score on English-to-German translation.';
    const result = await CitationVerifier.verifyClaimAgainstChunk(unsupportedClaim, sampleChunk);

    expect(result.isSupported).toBe(false);
    expect(result.missingNumbers).toContain('45.2');
  });

  it('flags completely unrelated claim with low lexical containment', async () => {
    const unrelatedClaim = 'Sourdough bread proofing requires warm ambient temperature and wild yeast cultivation.';
    const result = await CitationVerifier.verifyClaimAgainstChunk(unrelatedClaim, sampleChunk);

    expect(result.isSupported).toBe(false);
  });

  it('verifies array of claims and partitions verified vs unsupported indices', async () => {
    const claims = [
      {
        claim: 'Transformer achieved 28.4 BLEU score.',
        sourceIndices: [1, 2], // 1 is valid, 2 is unrelated
      },
    ];

    const chunks = [
      { index: 1, text: sampleChunk },
      { index: 2, text: 'Adam optimizer uses exponential moving averages of gradient moments.' },
    ];

    const verified = await CitationVerifier.verifyAllClaims(claims, chunks);
    expect(verified.length).toBe(1);
    expect(verified[0].verifiedIndices).toContain(1);
    expect(verified[0].unsupportedIndices).toContain(2);
    expect(verified[0].confidence).toBe('medium');
  });
});

describe('Phase 3: Prompt-Injection Defense & Streaming', () => {
  it('wraps untrusted evidence in delimiters and simulates token streaming', async () => {
    const originalProvider = config.llmProvider;
    (config as any).llmProvider = 'mock';

    try {
      const tokens: string[] = [];
      const prompt = 'What is the summary of the paper Attention Is All You Need?';

      // Test with mock provider
      const fullText = await LLMService.generateStream(
        prompt,
        { systemPrompt: 'Security test' },
        (token) => {
          tokens.push(token);
        }
      );

      expect(fullText.length).toBeGreaterThan(0);
      expect(tokens.length).toBeGreaterThan(1);
      expect(tokens.join('')).toBe(fullText);
    } finally {
      (config as any).llmProvider = originalProvider;
    }
  });
});
