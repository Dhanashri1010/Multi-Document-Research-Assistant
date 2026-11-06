import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multi_doc_research',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),

  vectorSearchProvider: (process.env.VECTOR_SEARCH_PROVIDER || 'local') as 'local' | 'atlas',
  vectorIndexName: process.env.VECTOR_INDEX_NAME || 'default',

  embeddingProvider: (process.env.EMBEDDING_PROVIDER || 'local') as 'local' | 'gemini' | 'openai',
  embeddingModel: process.env.EMBEDDING_MODEL || (process.env.EMBEDDING_PROVIDER === 'gemini' ? 'gemini-embedding-001' : 'all-MiniLM-L6-v2'),
  embeddingApiKey: process.env.EMBEDDING_API_KEY || process.env.LLM_API_KEY || '',

  llmProvider: (process.env.LLM_PROVIDER || 'gemini') as 'gemini' | 'openai' | 'ollama' | 'mock',
  llmModel: process.env.LLM_MODEL || 'gemini-3.5-flash-lite',
  llmApiKey: process.env.LLM_API_KEY || '',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',

  chunkTargetTokens: parseInt(process.env.CHUNK_TARGET_TOKENS || '380', 10),
  chunkOverlapTokens: parseInt(process.env.CHUNK_OVERLAP_TOKENS || '60', 10),
  llmTimeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '30000', 10),
  llmMaxRetries: parseInt(process.env.LLM_MAX_RETRIES || '2', 10),
  compareTimeoutMs: parseInt(process.env.COMPARE_TIMEOUT_MS || '30000', 10),
  preLlmCosineThreshold: parseFloat(process.env.PRE_LLM_COSINE_THRESHOLD || '0.28'),
  reranker: (process.env.RERANKER || 'off') as 'on' | 'off',
};
