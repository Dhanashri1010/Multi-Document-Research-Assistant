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

class LocalEmbeddingProvider implements EmbeddingProvider {
  private modelName = 'all-MiniLM-L6-v2';

  private async getExtractor() {
    if (!xenovaExtractor) {
      console.log(`[EmbeddingService] Loading local embedding model: Xenova/${this.modelName}...`);
      const { pipeline } = await import('@xenova/transformers');
      xenovaExtractor = await pipeline('feature-extraction', `Xenova/${this.modelName}`);
      console.log(`[EmbeddingService] Local embedding model loaded successfully.`);
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
    } catch (err) {
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
    const batchSize = 16;
    const dim = this.getDimension();

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
        const output = await extractor(batch, { pooling: 'mean', normalize: true });
        const data = output.data;
        for (let b = 0; b < batch.length; b++) {
          const slice = Array.from(data.slice(b * dim, (b + 1) * dim)) as number[];
          results.push(slice);
        }
      } catch (batchErr) {
        // Fallback to sequential items if batch fails
        for (const text of batch) {
          const output = await extractor(text, { pooling: 'mean', normalize: true });
          results.push(Array.from(output.data));
        }
      }
    }
    return results;
  }

  getModelName(): string {
    return this.modelName;
  }

  getDimension(): number {
    return 384;
  }
}

class GeminiEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimension = 768;

  constructor(apiKey: string, model: string = 'gemini-embedding-001') {
    this.apiKey = apiKey;
    this.model = model || 'gemini-embedding-001';
  }

  async embedQuery(text: string): Promise<number[]> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    const result = await ai.models.embedContent({
      model: this.model,
      contents: text,
      config: {
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: this.dimension,
      },
    });
    return result.embeddings?.[0]?.values || [];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: this.apiKey });

    const results: number[][] = [];
    const batchSize = 64; // Batch requests to avoid one HTTP call per chunk

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const res = await ai.models.embedContent({
        model: this.model,
        contents: batch,
        config: {
          taskType: 'RETRIEVAL_DOCUMENT',
          outputDimensionality: this.dimension,
        },
      });

      if (res.embeddings) {
        for (const emb of res.embeddings) {
          if (emb.values) {
            results.push(emb.values);
          }
        }
      }
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

