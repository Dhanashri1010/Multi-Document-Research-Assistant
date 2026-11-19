import { config } from '../../config/env.js';
import { EmbeddingThrottleQueue } from './embeddingThrottleQueue.js';

export interface EmbeddingProgressCallback {
  (embeddedCount: number, totalCount: number, statusMsg?: string): Promise<void> | void;
}

export interface EmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[], onProgress?: EmbeddingProgressCallback): Promise<number[][]>;
  getDimension(): number;
  getModelName(): string;
  countTokens?(text: string): Promise<number>;
}

// Singleton instances for lazy loading
let xenovaExtractor: any = null;

function formatMemoryMB(): string {
  const mem = process.memoryUsage();
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  return `RSS: ${rssMB}MB, Heap: ${heapMB}MB`;
}

class LocalEmbeddingProvider implements EmbeddingProvider {
  private modelName = 'all-MiniLM-L6-v2';

  private async getExtractor() {
    if (!xenovaExtractor) {
      console.log(`[EmbeddingService] Before model initialization (${formatMemoryMB()})`);
      console.log(`[EmbeddingService] Loading local embedding model: Xenova/${this.modelName}...`);
      const { pipeline, env } = await import('@xenova/transformers');
      // Enforce single-thread WASM execution to constrain memory on 512MB hosts
      if (env?.backends?.onnx?.wasm) {
        env.backends.onnx.wasm.numThreads = 1;
      }
      xenovaExtractor = await pipeline('feature-extraction', `Xenova/${this.modelName}`);
      console.log(`[EmbeddingService] Local embedding model loaded successfully (${formatMemoryMB()}).`);
    }
    return xenovaExtractor;
  }

  async countTokens(text: string): Promise<number> {
    try {
      const extractor = await this.getExtractor();
      if (extractor.tokenizer) {
        const encoded = await extractor.tokenizer(text);
        if (encoded?.input_ids?.data) {
          return encoded.input_ids.data.length;
        }
        if (Array.isArray(encoded?.input_ids)) {
          return encoded.input_ids.length;
        }
      }
    } catch (_err) {
      // Fallback silently if tokenizer error
    }
    return 0;
  }

  async embedQuery(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  async embedDocuments(texts: string[], onProgress?: EmbeddingProgressCallback): Promise<number[][]> {
    const extractor = await this.getExtractor();
    const results: number[][] = [];
    const total = texts.length;
    const dim = this.getDimension();

    console.log(`[EmbeddingService] Before embedding generation: ${total} chunks (${formatMemoryMB()})`);

    // Process chunks sequentially (batchSize = 1) to eliminate large activation buffers
    for (let i = 0; i < total; i++) {
      const text = texts[i];
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const vector = Array.from(output.data) as number[];

      if (!Array.isArray(vector) || vector.length !== dim) {
        throw new Error(
          `Local embedding dimension mismatch at chunk ${i}: expected ${dim}, received ${vector?.length || 0}`
        );
      }
      results.push(vector);

      if (onProgress && ((i + 1) % 5 === 0 || i + 1 === total)) {
        await onProgress(i + 1, total, `Embedding ${i + 1}/${total} chunks...`);
      }

      // Lightweight diagnostic logging every 10 processed chunks and on final chunk
      if ((i + 1) % 10 === 0 || i + 1 === total) {
        console.log(`[EmbeddingService] Processed ${i + 1}/${total} chunks (${formatMemoryMB()})`);
      }

      // Yield event loop between chunks to allow garbage collection and avoid event loop starvation
      if (i + 1 < total) {
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }

    console.log(`[EmbeddingService] Embedding completed: ${results.length} vectors generated (${formatMemoryMB()})`);
    return results;
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimension(): number {
    return 384;
  }
}

export function sanitizeErrorMessage(rawMsg: string): string {
  if (!rawMsg) return 'unknown error';
  return rawMsg
    .replace(/AIza[0-9A-Za-z_\-]{20,50}/g, '[REDACTED_API_KEY]')
    .replace(/(key|token|auth|secret|bearer)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s]+/g, (url) => {
      try {
        const parsed = new URL(url);
        parsed.search = '';
        return parsed.toString();
      } catch {
        return '[URL]';
      }
    })
    .slice(0, 200);
}

export function isGeminiRetryableError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status;
  const msg = String(err.message || '').toLowerCase();

  // Permanent non-retryable errors (client faults, auth, not found, or vector dimension mismatches)
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    msg.includes('api_key_invalid') ||
    msg.includes('invalid api key') ||
    msg.includes('unauthenticated') ||
    msg.includes('permission denied') ||
    msg.includes('not found') ||
    msg.includes('deprecated') ||
    msg.includes('mismatch') ||
    msg.includes('dimension') ||
    msg.includes('validation')
  ) {
    return false;
  }

  // Transient retryable errors (429 rate limits, 5xx server issues, network drops)
  if (status === 429 || (typeof status === 'number' && status >= 500 && status < 600)) {
    return true;
  }

  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('service unavailable') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('network')
  );
}

export function extractGeminiRetryDelayMs(err: any): number {
  if (!err) return 0;

  // 1. Check Google RPC RetryInfo in error details
  const retryInfo = err?.details?.find?.(
    (d: any) => typeof d === 'object' && d['@type']?.includes('RetryInfo')
  );
  if (retryInfo?.retryDelay) {
    const s = parseFloat(String(retryInfo.retryDelay).replace('s', ''));
    if (!isNaN(s) && s > 0) return Math.ceil(s * 1000);
  }

  // 2. Check error message for "retry in ~30s" or "retry after 30s"
  const msg = String(err?.message || '');
  const match = msg.match(/retry\s+(?:in|after)\s*~?\s*(\d+(?:\.\d+)?)\s*s/i);
  if (match && match[1]) {
    const s = parseFloat(match[1]);
    if (!isNaN(s) && s > 0) return Math.ceil(s * 1000);
  }

  // 3. Status 429 default to 30 seconds
  const status = err?.status || err?.statusCode || err?.response?.status;
  if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 30_000;
  }

  return 0;
}

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  maxRetries: number = 5,
  baseDelayMs: number = 2000,
  onProgress?: (msg: string) => Promise<void> | void
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt >= maxRetries || !isGeminiRetryableError(err)) {
        throw err;
      }
      attempt++;

      const serverDelayMs = extractGeminiRetryDelayMs(err);
      const isRateLimit = err?.status === 429 || String(err?.message || '').includes('429') || serverDelayMs > 0;

      let delayMs: number;
      if (isRateLimit) {
        if (baseDelayMs <= 100 || process.env.NODE_ENV === 'test') {
          delayMs = baseDelayMs;
        } else {
          const base = serverDelayMs > 0 ? serverDelayMs : 30_000;
          delayMs = base + Math.floor(Math.random() * 2000);
          // Pause the global throttle queue so concurrent uploads/queries back off
          EmbeddingThrottleQueue.pause(delayMs, 'Gemini 429 rate limit backoff');
        }
      } else {
        delayMs = Math.round(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500);
      }

      const waitSec = Math.ceil(delayMs / 1000);
      const safeErrorMsg = sanitizeErrorMessage(err?.message || String(err));
      console.warn(
        `[GeminiEmbeddingProvider] ${operationName} failed (attempt ${attempt}/${maxRetries}): ${safeErrorMsg}. Retrying in ${waitSec}s...`
      );

      if (onProgress) {
        const msg = isRateLimit
          ? `Waiting for Gemini rate limit, retrying in ${waitSec}s...`
          : `AI service temporarily unavailable, retrying in ${waitSec}s (attempt ${attempt}/${maxRetries})...`;
        await onProgress(msg);
      }

      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimension = 768;
  private maxRetries: number;
  private baseDelayMs: number;

  constructor(
    apiKey: string,
    model: string = 'gemini-embedding-001',
    options?: { maxRetries?: number; baseDelayMs?: number }
  ) {
    this.apiKey = apiKey;
    this.model = model || 'gemini-embedding-001';
    this.maxRetries = options?.maxRetries ?? 5;
    this.baseDelayMs = options?.baseDelayMs ?? 2000;
  }

  async embedQuery(text: string): Promise<number[]> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const tokenEstimate = EmbeddingThrottleQueue.estimateTokens(text);

    return withGeminiRetry(
      async () => {
        // Enforce global rate limit / queue spacing
        await EmbeddingThrottleQueue.acquire(tokenEstimate);

        const result = await ai.models.embedContent({
          model: this.model,
          contents: text,
          config: {
            taskType: 'RETRIEVAL_QUERY',
            outputDimensionality: this.dimension,
          },
        });

        const vector = result.embeddings?.[0]?.values;
        if (!Array.isArray(vector) || vector.length !== this.dimension) {
          throw new Error(
            `Gemini query embedding failed: expected ${this.dimension}-dim vector, got ${vector?.length ?? 'none'}`
          );
        }
        return vector;
      },
      'embedQuery',
      this.maxRetries,
      this.baseDelayMs
    );
  }

  async embedDocuments(texts: string[], onProgress?: EmbeddingProgressCallback): Promise<number[][]> {
    if (texts.length === 0) return [];

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const results: number[][] = [];
    const batchSize = 30; // Max 30 chunks per call (~10k tokens) to stay well under the 20K TPM limit
    const total = texts.length;

    for (let i = 0; i < total; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(total / batchSize);
      const tokenEstimate = EmbeddingThrottleQueue.estimateTokens(batch);

      const batchVectors = await withGeminiRetry(
        async () => {
          // Acquire capacity from global throttle queue
          await EmbeddingThrottleQueue.acquire(tokenEstimate, async (waitSec, reason) => {
            if (onProgress) {
              await onProgress(
                results.length,
                total,
                `Waiting for Gemini rate limit (${reason}), resuming in ${waitSec}s...`
              );
            }
          });

          if (onProgress) {
            await onProgress(
              results.length,
              total,
              `Embedding ${results.length}/${total} chunks...`
            );
          }

          const res = await ai.models.embedContent({
            model: this.model,
            contents: batch,
            config: {
              taskType: 'RETRIEVAL_DOCUMENT',
              outputDimensionality: this.dimension,
            },
          });

          const embeddings = res.embeddings;
          if (!Array.isArray(embeddings) || embeddings.length !== batch.length) {
            throw new Error(
              `Gemini batch embedding mismatch for batch ${batchIndex}/${totalBatches}: expected ${batch.length} vectors, got ${embeddings?.length ?? 0}`
            );
          }

          const extracted: number[][] = [];
          for (let b = 0; b < embeddings.length; b++) {
            const vals = embeddings[b]?.values;
            if (!Array.isArray(vals) || vals.length !== this.dimension) {
              throw new Error(
                `Gemini embedding vector dimension mismatch at batch index ${b}: expected ${this.dimension}, got ${vals?.length ?? 'none'}`
              );
            }
            extracted.push(vals);
          }
          return extracted;
        },
        `embedDocuments batch ${batchIndex}/${totalBatches}`,
        this.maxRetries,
        this.baseDelayMs,
        async (msg: string) => {
          if (onProgress) {
            await onProgress(results.length, total, msg);
          }
        }
      );

      for (const vec of batchVectors) {
        results.push(vec);
      }

      if (onProgress) {
        await onProgress(
          results.length,
          total,
          `Embedding ${results.length}/${total} chunks...`
        );
      }
    }

    if (results.length !== texts.length) {
      throw new Error(
        `Gemini document embedding total mismatch: expected ${texts.length} vectors, got ${results.length}`
      );
    }

    return results;
  }

  getModelName(): string {
    return this.model;
  }

  getDimension(): number {
    return this.dimension;
  }
}

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async embedQuery(text: string): Promise<number[]> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.apiKey });
    const resp = await client.embeddings.create({
      model: this.model,
      input: text,
    });
    return resp.data[0].embedding;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: this.apiKey });
    const results: number[][] = [];
    const batchSize = 100; // Batch OpenAI embeddings in chunks of ~100 inputs

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const resp = await client.embeddings.create({
        model: this.model,
        input: batch,
      });
      for (const item of resp.data) {
        if (item.embedding) {
          results.push(item.embedding);
        }
      }
    }
    return results;
  }

  getModelName(): string {
    return this.model;
  }

  getDimension(): number {
    return 1536;
  }
}

class MockEmbeddingProvider implements EmbeddingProvider {
  getModelName(): string {
    return 'mock-embedding';
  }

  getDimension(): number {
    return 8;
  }

  async embedQuery(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
  }
}

let activeProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (activeProvider) return activeProvider;

  const providerType = config.embeddingProvider as string;
  console.log(`[EmbeddingService] Initializing embedding provider: ${providerType}`);

  if (providerType === 'mock') {
    activeProvider = new MockEmbeddingProvider();
  } else if (providerType === 'gemini') {
    if (!config.embeddingApiKey) {
      console.warn(`[EmbeddingService] Warning: GEMINI API key not provided for embeddings, falling back to local model.`);
      activeProvider = new LocalEmbeddingProvider();
    } else {
      activeProvider = new GeminiEmbeddingProvider(config.embeddingApiKey, config.embeddingModel);
    }
  } else if (providerType === 'openai') {
    if (!config.embeddingApiKey) {
      console.warn(`[EmbeddingService] Warning: OpenAI API key not provided for embeddings, falling back to local model.`);
      activeProvider = new LocalEmbeddingProvider();
    } else {
      activeProvider = new OpenAIEmbeddingProvider(config.embeddingApiKey, config.embeddingModel);
    }
  } else {
    activeProvider = new LocalEmbeddingProvider();
  }

  return activeProvider;
}

export async function countTokensWithTokenizer(text: string): Promise<number | null> {
  const provider = getEmbeddingProvider();
  if (provider.countTokens) {
    const count = await provider.countTokens(text);
    if (count > 0) return count;
  }
  return null;
}

