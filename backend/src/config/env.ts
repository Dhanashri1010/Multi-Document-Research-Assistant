import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/multi_doc_research'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(25),

  VECTOR_SEARCH_PROVIDER: z.enum(['local', 'atlas']).default('local'),
  VECTOR_INDEX_NAME: z.string().default('default'),

  EMBEDDING_PROVIDER: z.enum(['local', 'gemini', 'openai']).default('local'),
  EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_API_KEY: z.string().optional(),

  LLM_PROVIDER: z.enum(['gemini', 'openai', 'ollama', 'mock']).default('gemini'),
  LLM_MODEL: z.string().default('gemini-3.5-flash-lite'),
  LLM_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),

  CHUNK_TARGET_TOKENS: z.coerce.number().int().positive().default(380),
  CHUNK_OVERLAP_TOKENS: z.coerce.number().int().nonnegative().default(60),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  LLM_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  COMPARE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  PRE_LLM_COSINE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.28),
  RERANKER: z.enum(['on', 'off']).default('off'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const errorDetails = parsed.error.issues
    .map((issue) => `  - [${issue.path.join('.')}] ${issue.message}`)
    .join('\n');
  console.error('\n======================================================');
  console.error(' [FATAL] Environment Configuration Validation Failed:');
  console.error(errorDetails);
  console.error('======================================================\n');
  throw new Error(`Invalid environment configuration:\n${errorDetails}`);
}

const env = parsed.data;

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  frontendUrl: env.FRONTEND_URL,
  mongoUri: env.MONGODB_URI,
  uploadDir: env.UPLOAD_DIR,
  maxFileSizeMB: env.MAX_FILE_SIZE_MB,

  vectorSearchProvider: env.VECTOR_SEARCH_PROVIDER,
  vectorIndexName: env.VECTOR_INDEX_NAME,

  embeddingProvider: env.EMBEDDING_PROVIDER,
  embeddingModel:
    env.EMBEDDING_MODEL ||
    (env.EMBEDDING_PROVIDER === 'gemini' ? 'gemini-embedding-001' : 'all-MiniLM-L6-v2'),
  embeddingApiKey: env.EMBEDDING_API_KEY || env.LLM_API_KEY || '',

  llmProvider: env.LLM_PROVIDER,
  llmModel: env.LLM_MODEL,
  llmApiKey: env.LLM_API_KEY || '',
  ollamaBaseUrl: env.OLLAMA_BASE_URL,

  chunkTargetTokens: env.CHUNK_TARGET_TOKENS,
  chunkOverlapTokens: env.CHUNK_OVERLAP_TOKENS,
  llmTimeoutMs: env.LLM_TIMEOUT_MS,
  llmMaxRetries: env.LLM_MAX_RETRIES,
  compareTimeoutMs: env.COMPARE_TIMEOUT_MS,
  preLlmCosineThreshold: env.PRE_LLM_COSINE_THRESHOLD,
  reranker: env.RERANKER,
};
