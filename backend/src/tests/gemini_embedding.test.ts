import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GeminiEmbeddingProvider,
  isGeminiRetryableError,
  sanitizeErrorMessage,
  withGeminiRetry,
} from '../services/ai/embeddingService.js';
import { config } from '../config/env.js';
import { cosineSimilarity } from '../services/ai/vectorStore.js';

// Hoisted mock for @google/genai
const mockEmbedContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: mockEmbedContent,
    },
  })),
}));

describe('GeminiEmbeddingProvider & Retry Engine', () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
  });

  describe('1. Error Classification (Retryable vs Permanent)', () => {
    it('classifies permanent errors as non-retryable', () => {
      expect(isGeminiRetryableError({ status: 400, message: 'Bad Request' })).toBe(false);
      expect(isGeminiRetryableError({ status: 401, message: 'API_KEY_INVALID' })).toBe(false);
      expect(isGeminiRetryableError({ status: 403, message: 'Permission Denied' })).toBe(false);
      expect(isGeminiRetryableError({ status: 404, message: 'models/not-found was not found' })).toBe(false);
      expect(isGeminiRetryableError(new Error('Invalid API key provided'))).toBe(false);
      expect(isGeminiRetryableError(new Error('Request contains unauthenticated caller'))).toBe(false);
      expect(isGeminiRetryableError(new Error('Gemini embedding vector dimension mismatch: expected 768, got 2'))).toBe(false);
      expect(isGeminiRetryableError(new Error('Gemini batch embedding mismatch for batch 1/1: expected 64 vectors, got 0'))).toBe(false);
    });

    it('classifies transient errors as retryable', () => {
      expect(isGeminiRetryableError({ status: 429, message: 'RESOURCE_EXHAUSTED' })).toBe(true);
      expect(isGeminiRetryableError({ status: 503, message: 'The model is overloaded. Please try again later.' })).toBe(true);
      expect(isGeminiRetryableError({ status: 500, message: 'Internal Server Error' })).toBe(true);
      expect(isGeminiRetryableError({ status: 502, message: 'Bad Gateway' })).toBe(true);
      expect(isGeminiRetryableError({ status: 504, message: 'Gateway Timeout' })).toBe(true);
      expect(isGeminiRetryableError(new Error('Rate limit exceeded: 429'))).toBe(true);
      expect(isGeminiRetryableError(new Error('Quota exceeded for metric'))).toBe(true);
      expect(isGeminiRetryableError(new Error('read ECONNRESET'))).toBe(true);
      expect(isGeminiRetryableError(new Error('connect ETIMEDOUT'))).toBe(true);
    });

    it('handles null or undefined error safely', () => {
      expect(isGeminiRetryableError(null)).toBe(false);
      expect(isGeminiRetryableError(undefined)).toBe(false);
    });

    it('sanitizes API keys, authorization tokens and sensitive URLs from error strings', () => {
      const sensitive1 = 'Request failed: https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD-fakeKey1234567890abcdefghijk';
      const sanitized1 = sanitizeErrorMessage(sensitive1);
      expect(sanitized1).not.toContain('AIzaSyD-fakeKey1234567890abcdefghijk');
      expect(sanitized1).toBe('Request failed: https://generativelanguage.googleapis.com/v1beta/models');

      const sensitive2 = 'API call failed with key AIzaSyD-fakeKey1234567890abcdefghijk';
      const sanitized2 = sanitizeErrorMessage(sensitive2);
      expect(sanitized2).not.toContain('AIzaSyD-fakeKey1234567890abcdefghijk');
      expect(sanitized2).toContain('[REDACTED_API_KEY]');

      const sensitive3 = 'Authorization header Bearer secret_jwt_token_999 rejected with token=abc123secret';
      const sanitized3 = sanitizeErrorMessage(sensitive3);
      expect(sanitized3).not.toContain('secret_jwt_token_999');
      expect(sanitized3).not.toContain('abc123secret');
      expect(sanitized3).toContain('Bearer [REDACTED]');
      expect(sanitized3).toContain('token=[REDACTED]');
    });
  });

  describe('2. Retry Engine Behavior (withGeminiRetry)', () => {
    it('resolves immediately when operation succeeds on first attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const result = await withGeminiRetry(mockFn, 'testOp', 3, 5);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('retries on transient 429 error and succeeds on subsequent attempt', async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          const err: any = new Error('Resource exhausted: 429');
          err.status = 429;
          throw err;
        }
        return 'eventual success';
      });

      const result = await withGeminiRetry(mockFn, 'testOp', 3, 5);

      expect(result).toBe('eventual success');
      expect(callCount).toBe(3); // 1 initial + 2 retries
    });

    it('does not retry permanent authentication/permission errors (401/403)', async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        callCount++;
        const err: any = new Error('Invalid API key');
        err.status = 401;
        throw err;
      });

      await expect(withGeminiRetry(mockFn, 'testOp', 3, 5)).rejects.toThrow('Invalid API key');
      expect(callCount).toBe(1); // Aborted immediately without retrying
    });

    it('throws error after exhausting maximum retries (3 retries)', async () => {
      let callCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        callCount++;
        const err: any = new Error('Service Unavailable: 503');
        err.status = 503;
        throw err;
      });

      await expect(withGeminiRetry(mockFn, 'testOp', 3, 5)).rejects.toThrow('Service Unavailable: 503');
      expect(callCount).toBe(4); // 1 initial attempt + 3 retries
    });
  });

  describe('3. GeminiEmbeddingProvider Unit Testing (Mocked GenAI SDK)', () => {
    it('returns correct model name and dimension', () => {
      const provider = new GeminiEmbeddingProvider('dummy-key', 'gemini-embedding-001');
      expect(provider.getModelName()).toBe('gemini-embedding-001');
      expect(provider.getDimension()).toBe(768);
    });

    it('embeds single query returning 768-dimensional vector', async () => {
      const mockValues = new Array(768).fill(0.0123);
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: mockValues }],
      });

      const provider = new GeminiEmbeddingProvider('dummy-key', 'gemini-embedding-001', {
        maxRetries: 1,
        baseDelayMs: 5,
      });

      const vector = await provider.embedQuery('test query');
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBe(768);
      expect(vector[0]).toBe(0.0123);
    });

    it('embeds multiple documents preserving count and exact input ordering', async () => {
      const vec1 = new Array(768).fill(0.1);
      const vec2 = new Array(768).fill(0.2);
      const vec3 = new Array(768).fill(0.3);

      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: vec1 }, { values: vec2 }, { values: vec3 }],
      });

      const provider = new GeminiEmbeddingProvider('dummy-key', 'gemini-embedding-001', {
        maxRetries: 1,
        baseDelayMs: 5,
      });

      const results = await provider.embedDocuments(['Doc 1', 'Doc 2', 'Doc 3']);
      expect(results.length).toBe(3);
      expect(results[0][0]).toBe(0.1);
      expect(results[1][0]).toBe(0.2);
      expect(results[2][0]).toBe(0.3);
      expect(results[0].length).toBe(768);
      expect(results[1].length).toBe(768);
      expect(results[2].length).toBe(768);
    });

    it('returns empty array when embedding empty documents list', async () => {
      const provider = new GeminiEmbeddingProvider('dummy-key');
      const results = await provider.embedDocuments([]);
      expect(results).toEqual([]);
      expect(mockEmbedContent).not.toHaveBeenCalled();
    });

    it('throws when API returns invalid dimension vector', async () => {
      mockEmbedContent.mockResolvedValueOnce({
        embeddings: [{ values: [0.1, 0.2] }], // Corrupted dimension (2 instead of 768)
      });

      const provider = new GeminiEmbeddingProvider('dummy-key', 'gemini-embedding-001', {
        maxRetries: 0,
        baseDelayMs: 5,
      });

      await expect(provider.embedDocuments(['Doc 1'])).rejects.toThrow(
        /Gemini embedding vector dimension mismatch/
      );
    });
  });

  describe('4. Real Gemini Integration Test (Executed only when API key is available & online)', () => {
    const activeKey = config.embeddingApiKey;
    const canRunLiveTest = Boolean(activeKey) && config.embeddingProvider === 'gemini';

    it.runIf(canRunLiveTest)('successfully computes live 768-dim embeddings with semantic similarity', async () => {
      const provider = new GeminiEmbeddingProvider(activeKey, 'gemini-embedding-001');
      expect(provider.getDimension()).toBe(768);

      const queryVector = await provider.embedQuery('Artificial intelligence and neural networks');
      expect(queryVector.length).toBe(768);

      const docs = [
        'Deep learning models use multi-layer perceptrons and backpropagation.',
        'The culinary history of sourdough bread fermentation and baking.',
      ];

      const docVectors = await provider.embedDocuments(docs);
      expect(docVectors.length).toBe(2);
      expect(docVectors[0].length).toBe(768);
      expect(docVectors[1].length).toBe(768);

      // Semantic proximity assertion
      const simRelated = cosineSimilarity(queryVector, docVectors[0]);
      const simUnrelated = cosineSimilarity(queryVector, docVectors[1]);
      expect(simRelated).toBeGreaterThan(simUnrelated);
    });
  });
});
