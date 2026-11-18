import { config } from '../../config/env.js';

export interface EmbeddingProvider {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
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

  async embedDocuments(texts: string[]): Promise<number[][]> {
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

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelayMs: number = 2000
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
      // Exponential backoff: ~2s, ~4s, ~8s with random jitter (0 to 500ms)
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500);
      const safeErrorMsg = sanitizeErrorMessage(err?.message || String(err));
      console.warn(
        `[GeminiEmbeddingProvider] ${operationName} failed (attempt ${attempt}/${maxRetries}): ${safeErrorMsg}. Retrying in ${delay}ms...`
      );
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
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
    this.maxRetries = options?.maxRetries ?? 3;
    this.baseDelayMs = options?.baseDelayMs ?? 2000;
  }

  async embedQuery(text: string): Promise<number[]> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    return withGeminiRetry(
      async () => {
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

  async embedDocuments(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const results: number[][] = [];
    const batchSize = 64; // Batch requests to avoid one HTTP call per chunk

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchIndex = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / batchSize);

      const batchVectors = await withGeminiRetry(
        async () => {
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
        this.baseDelayMs
      );

      for (const vec of batchVectors) {
        results.push(vec);
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

