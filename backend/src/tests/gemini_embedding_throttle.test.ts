import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractGeminiRetryDelayMs,
  withGeminiRetry,
  GeminiEmbeddingProvider,
} from '../services/ai/embeddingService.js';
import { EmbeddingThrottleQueue } from '../services/ai/embeddingThrottleQueue.js';

// Hoisted mock for @google/genai
const mockEmbedContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      embedContent: mockEmbedContent,
    },
  })),
}));

describe('Gemini Embedding Throttle & 429 Resilience', () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
    EmbeddingThrottleQueue.reset();
  });

  describe('1. Retry Delay Extraction', () => {
    it('extracts delay from Google RPC RetryInfo', () => {
      const err = {
        status: 429,
        message: 'Resource exhausted',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '3s',
          },
        ],
      };
      const delay = extractGeminiRetryDelayMs(err);
      expect(delay).toBe(3000);
    });

    it('extracts delay from error message regex', () => {
      const err = {
        message: 'Embed content requests per minute limit exceeded. Please retry in ~5s.',
      };
      const delay = extractGeminiRetryDelayMs(err);
      expect(delay).toBe(5000);
    });

    it('defaults to 30 seconds on 429 when no explicit delay is provided', () => {
      const err = {
        status: 429,
        message: 'RESOURCE_EXHAUSTED',
      };
      const delay = extractGeminiRetryDelayMs(err);
      expect(delay).toBe(30000);
    });
  });

  describe('2. 429 Rate Limit Retry with Server Delay', () => {
    it('retries on 429 with parsed server delay and completes successfully', async () => {
      let callCount = 0;
      const progressMessages: string[] = [];

      const mockOperation = async () => {
        callCount++;
        if (callCount === 1) {
          const rateErr: any = new Error('Rate limit exceeded. Please retry in ~0.05s.');
          rateErr.status = 429;
          throw rateErr;
        }
        return 'embedding_vector_batch_ready';
      };

      const result = await withGeminiRetry(
        mockOperation,
        'testBatchEmbed',
        3,
        10,
        (msg) => {
          progressMessages.push(msg);
        }
      );

      expect(callCount).toBe(2);
      expect(result).toBe('embedding_vector_batch_ready');
      expect(progressMessages.length).toBeGreaterThanOrEqual(1);
      expect(progressMessages[0]).toContain('Waiting for Gemini rate limit');
    });
  });

  describe('3. Global EmbeddingThrottleQueue Concurrency', () => {
    it('allows concurrent calls to acquire capacity safely', async () => {
      const queue = EmbeddingThrottleQueue;

      const results: number[] = [];
      const task1 = queue.acquire(500).then(() => results.push(1));
      const task2 = queue.acquire(500).then(() => results.push(2));
      const task3 = queue.acquire(500).then(() => results.push(3));

      await Promise.all([task1, task2, task3]);
      expect(results).toHaveLength(3);
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
    });

    it('pauses global queue when 429 backoff is triggered', async () => {
      EmbeddingThrottleQueue.pause(100, 'Test 429 rate limit');

      const start = Date.now();
      await EmbeddingThrottleQueue.acquire(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(80);
    });
  });

  describe('4. Batch Embedding Provider', () => {
    it('batches chunks into groups and returns vectors', async () => {
      const provider = new GeminiEmbeddingProvider('dummy_key', 'gemini-embedding-001', {
        maxRetries: 2,
        baseDelayMs: 10,
      });

      // Mock returning 768-dim vector for each content in batch
      mockEmbedContent.mockImplementation(async ({ contents }) => {
        const batchLength = Array.isArray(contents) ? contents.length : 1;
        return {
          embeddings: Array.from({ length: batchLength }, () => ({
            values: new Array(768).fill(0.01),
          })),
        };
      });

      const sampleTexts = Array.from({ length: 65 }, (_, i) => `Sample chunk text ${i}`);
      const progressUpdates: { current: number; total: number }[] = [];

      const vectors = await provider.embedDocuments(sampleTexts, (current, total) => {
        progressUpdates.push({ current, total });
      });

      expect(vectors).toHaveLength(65);
      expect(vectors[0]).toHaveLength(768);
      // Batch size is 10, so 65 items = 7 batches (6 x 10 + 1 x 5)
      expect(mockEmbedContent).toHaveBeenCalledTimes(7);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });
});

