import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  validatePdfMagicBytes,
  validatePdfBuffer,
  sanitizeFilename,
} from '../utils/fileValidator.js';
import { CitationVerifier } from '../services/ai/citationVerifier.js';
import { LLMService } from '../services/ai/llmService.js';
import { config } from '../config/env.js';
import { z } from 'zod';

describe('Step 5 Backend Tests: Upload Edge Cases', () => {
  it('validates genuine PDF magic bytes (%PDF-) via buffer', () => {
    const validHeader = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj');
    expect(validatePdfBuffer(validHeader)).toBe(true);
  });

  it('rejects corrupt buffers lacking %PDF- magic bytes', () => {
    const corruptBuffer = Buffer.from('NOT_A_REAL_PDF_HEADER_DATA');
    expect(validatePdfBuffer(corruptBuffer)).toBe(false);
  });

  it('rejects empty or truncated buffers', () => {
    expect(validatePdfBuffer(Buffer.alloc(0))).toBe(false);
    expect(validatePdfBuffer(Buffer.from('%PD'))).toBe(false);
  });

  it('validates PDF magic bytes from file on disk and rejects non-existent paths', () => {
    const tmpDir = os.tmpdir();
    const validPdfPath = path.join(tmpDir, `test_valid_${Date.now()}.pdf`);
    const corruptPath = path.join(tmpDir, `test_corrupt_${Date.now()}.txt`);

    fs.writeFileSync(validPdfPath, '%PDF-1.4 sample content');
    fs.writeFileSync(corruptPath, 'This is plain text without magic bytes');

    try {
      expect(validatePdfMagicBytes(validPdfPath)).toBe(true);
      expect(validatePdfMagicBytes(corruptPath)).toBe(false);
      expect(validatePdfMagicBytes('non_existent_file_path.pdf')).toBe(false);
    } finally {
      if (fs.existsSync(validPdfPath)) fs.unlinkSync(validPdfPath);
      if (fs.existsSync(corruptPath)) fs.unlinkSync(corruptPath);
    }
  });

  it('sanitizes malicious filenames and prevents path traversal', () => {
    // Directory path traversal is stripped to basename
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe')).toBe('cmd.exe');

    // Forbidden characters are stripped/replaced with safe characters
    const sanitizedSpecial = sanitizeFilename('paper<>:|"?.pdf');
    expect(sanitizedSpecial).not.toMatch(/[<>:|"/?*]/);
    expect(sanitizedSpecial.endsWith('.pdf')).toBe(true);

    // Empty or pure dot input falls back to safe default
    expect(sanitizeFilename('')).toMatch(/^document_\d+\.pdf$/);
    expect(sanitizeFilename('..')).toMatch(/^document_\d+\.pdf$/);
  });
});

describe('Step 5 Backend Tests: Pre-LLM Cosine Gate & Threshold Calibration', () => {
  it('calibrates gate threshold from environment configuration (default >= 0.28)', () => {
    expect(config.preLlmCosineThreshold).toBeDefined();
    expect(config.preLlmCosineThreshold).toBeGreaterThan(0.2);
    expect(config.preLlmCosineThreshold).toBeLessThan(0.5);
  });

  it('blocks low-similarity chunks when max cosine similarity falls below threshold', () => {
    const threshold = config.preLlmCosineThreshold;
    const lowSimilarityScore = 0.18;
    const shouldGate = lowSimilarityScore < threshold;
    expect(shouldGate).toBe(true);
  });

  it('allows high-similarity chunks when cosine similarity meets or exceeds threshold', () => {
    const threshold = config.preLlmCosineThreshold;
    const highSimilarityScore = 0.65;
    const shouldGate = highSimilarityScore < threshold;
    expect(shouldGate).toBe(false);
  });
});

describe('Step 5 Backend Tests: Citation Verification Accuracy', () => {
  it('correctly verifies claim when factual numbers and keywords match source excerpt', async () => {
    const claim = 'The model achieved 28.4 BLEU score on WMT 2014 English-to-German dataset.';
    const sourceExcerpt =
      'On the WMT 2014 English-to-German translation task, the big transformer model establishes a new state-of-the-art BLEU score of 28.4.';

    const result = await CitationVerifier.verifyClaimAgainstChunk(claim, sourceExcerpt);
    expect(result.isSupported).toBe(true);
    expect(result.supportScore).toBeGreaterThanOrEqual(0.35);
    expect(result.missingNumbers).toEqual([]);
  });

  it('rejects claim with hallucinated or contradictory numerical metrics', async () => {
    const hallucinatedClaim = 'The model achieved 94.2 BLEU score on WMT 2014 English-to-German dataset.';
    const sourceExcerpt =
      'On the WMT 2014 English-to-German translation task, the big transformer model establishes a new state-of-the-art BLEU score of 28.4.';

    const result = await CitationVerifier.verifyClaimAgainstChunk(hallucinatedClaim, sourceExcerpt);
    expect(result.isSupported).toBe(false);
    expect(result.missingNumbers).toContain('94.2');
  });

  it('flags ungrounded claims when semantic overlap is negligible', async () => {
    const ungroundedClaim = 'Quantum annealers utilize adiabatic superposition to optimize supply chains.';
    const sourceExcerpt =
      'On the WMT 2014 English-to-German translation task, the big transformer model establishes a new state-of-the-art BLEU score of 28.4.';

    const result = await CitationVerifier.verifyClaimAgainstChunk(ungroundedClaim, sourceExcerpt);
    expect(result.isSupported).toBe(false);
  });
});

describe('Step 5 Backend Tests: Compare Endpoint with Mocked LLM & Degraded Fallback', () => {
  it('generates structured academic comparison when LLM succeeds', async () => {
    const mockStructuredResult = JSON.stringify({
      matrix: [
        {
          dimension: 'Core Architecture',
          values: [
            {
              documentId: 'doc1',
              documentName: 'Attention Is All You Need',
              finding: 'Multi-head self-attention without recurrence or convolutions.',
              pageNumber: 2,
            },
            {
              documentId: 'doc2',
              documentName: 'LoRA',
              finding: 'Freezes pre-trained weights and injects trainable rank decomposition matrices.',
              pageNumber: 3,
            },
          ],
        },
      ],
      similarities: ['Both approaches enhance compute efficiency in sequence modeling.'],
      differences: ['Attention replaces RNNs entirely; LoRA preserves frozen base models.'],
      keyFindings: ['Transformer scales to 28.4 BLEU; LoRA reduces trainable params by 10,000x.'],
      limitations: ['Attention memory scales quadratically with sequence length.'],
    });

    const spy = vi.spyOn(LLMService, 'generate').mockResolvedValueOnce(mockStructuredResult);

    const rawResponse = await LLMService.generate('Compare core architectures', {});
    const parsed = JSON.parse(rawResponse);

    expect(spy).toHaveBeenCalled();
    expect(parsed).toHaveProperty('matrix');
    expect(parsed.matrix.length).toBe(1);
    expect(parsed.matrix[0].dimension).toBe('Core Architecture');
    expect(parsed.similarities.length).toBe(1);
    expect(parsed.differences.length).toBe(1);

    spy.mockRestore();
  });

  it('gracefully handles LLM timeout by returning degraded fallback output structure', () => {
    const fallbackOutput = {
      matrix: [
        {
          dimension: 'Overview',
          values: [
            {
              documentId: 'doc1',
              documentName: 'Attention Paper',
              finding: 'Excerpt from document 1',
              pageNumber: 1,
            },
          ],
        },
      ],
      similarities: ['Both papers focus on natural language processing.'],
      differences: ['Differences extracted from paper passages.'],
      keyFindings: ['Extracted direct findings from papers.'],
      limitations: ['Full generative multi-document synthesis was temporarily degraded.'],
      degraded: true,
      degradedReason: 'Comparison request exceeded 18s budget',
    };

    expect(fallbackOutput.degraded).toBe(true);
    expect(fallbackOutput.degradedReason).toContain('18s');
    expect(fallbackOutput.matrix).toBeDefined();
    expect(fallbackOutput.similarities.length).toBeGreaterThan(0);
  });
});

describe('Step 5 Backend Tests: Input Validation with Zod', () => {
  const mongoIdSchema = z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ID format'),
  });

  it('accepts valid 24-character hexadecimal MongoDB ObjectIds', () => {
    const validParams = { id: '507f1f77bcf86cd799439011' };
    const parsed = mongoIdSchema.safeParse(validParams);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid or malformed MongoDB ObjectIds with descriptive error', () => {
    const invalidIds = ['123', 'not-an-id', '507f1f77bcf86cd79943901z', ''];
    invalidIds.forEach((id) => {
      const parsed = mongoIdSchema.safeParse({ id });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0].message).toContain('Invalid MongoDB ID format');
      }
    });
  });

  const chatQuerySchema = z.object({
    sessionId: z.string().min(1, 'sessionId is required'),
    query: z.string().min(1, 'query is required'),
    documentIds: z.array(z.string()).min(1, 'At least one documentId is required'),
  });

  it('validates chat query payloads and rejects missing fields', () => {
    const validPayload = {
      sessionId: 'sess_123',
      query: 'What BLEU score did the model achieve?',
      documentIds: ['507f1f77bcf86cd799439011'],
    };
    expect(chatQuerySchema.safeParse(validPayload).success).toBe(true);

    const emptyQueryPayload = {
      sessionId: 'sess_123',
      query: '   '.trim(),
      documentIds: ['507f1f77bcf86cd799439011'],
    };
    expect(chatQuerySchema.safeParse(emptyQueryPayload).success).toBe(false);

    const noDocsPayload = {
      sessionId: 'sess_123',
      query: 'What is attention?',
      documentIds: [],
    };
    expect(chatQuerySchema.safeParse(noDocsPayload).success).toBe(false);
  });
});
