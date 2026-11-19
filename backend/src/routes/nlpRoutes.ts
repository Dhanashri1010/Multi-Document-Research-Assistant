import { Router } from 'express';
import { z } from 'zod';
import { NlpController } from '../controllers/nlpController.js';
import { validateBody } from '../middleware/validateRequest.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Rate limit: 60 requests per minute per IP for NLP endpoints
const nlpRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 60,
  message: 'Too many NLP analysis requests. Please wait a moment before trying again.',
});

router.use(nlpRateLimiter);
router.use(requireAuth);

const preprocessBodySchema = z.object({
  documentId: z.string().optional(),
  rawText: z.string().max(100_000).optional(),
  steps: z
    .object({
      unicodeNormalization: z.boolean().optional(),
      lowercase: z.boolean().optional(),
      noiseRemoval: z.boolean().optional(),
      headerFooterRemoval: z.boolean().optional(),
      hyphenationRepair: z.boolean().optional(),
      tokenization: z.boolean().optional(),
      stopwordRemoval: z.boolean().optional(),
      stemming: z.boolean().optional(),
    })
    .optional(),
  useCache: z.boolean().optional(),
});

const vectorizeBodySchema = z.object({
  documentIds: z.array(z.string().min(1)).min(1).max(10),
  useCache: z.boolean().optional(),
});

const sentimentBodySchema = z.object({
  documentId: z.string().min(1),
  runGemini: z.boolean().optional(),
  sampleSize: z.number().int().min(5).max(60).optional(),
  useCache: z.boolean().optional(),
});

const extractBodySchema = z.object({
  documentId: z.string().min(1),
  runGemini: z.boolean().optional(),
  useCache: z.boolean().optional(),
});

const evaluationRunSchema = z.object({
  forceRefresh: z.boolean().optional(),
});

const topicsBodySchema = z.object({
  documentIds: z.array(z.string()).optional(),
  k: z.number().int().min(2).max(6).optional(),
  sampleMax: z.number().int().min(10).max(1000).optional(),
  generateAiTitles: z.boolean().optional(),
  forceRefresh: z.boolean().optional(),
});

const detectLangSchema = z.object({
  text: z.string().min(1).max(50_000),
});

const translateSchema = z.object({
  text: z.string().min(1).max(10_000),
  targetLanguage: z.string().min(2).max(10),
  sourceLanguage: z.string().max(10).optional(),
  provider: z.enum(['auto', 'google_cloud', 'gemini', 'local']).optional(),
  forceRefresh: z.boolean().optional(),
});

const crossLingualQaSchema = z.object({
  question: z.string().min(1).max(2000),
  documentIds: z.array(z.string()).optional(),
  targetLanguage: z.string().max(10).optional(),
});

const literatureReviewSchema = z.object({
  documentIds: z.array(z.string().min(1)).min(2).max(5),
  forceRefresh: z.boolean().optional(),
});

// Endpoints
router.post('/preprocess', validateBody(preprocessBodySchema), NlpController.preprocess);
router.post('/vectorize', validateBody(vectorizeBodySchema), NlpController.vectorize);
router.post('/sentiment', validateBody(sentimentBodySchema), NlpController.sentiment);
router.post('/extract', validateBody(extractBodySchema), NlpController.extract);
router.post('/evaluation/run', validateBody(evaluationRunSchema), NlpController.runEvaluation);
router.get('/evaluation/results', NlpController.getEvaluationReport);
router.get('/llm-quota', NlpController.getLlmQuota);
router.get('/prompts', NlpController.listPrompts);
router.post('/topics', validateBody(topicsBodySchema), NlpController.topics);
router.post('/multilingual/detect', validateBody(detectLangSchema), NlpController.detectLanguage);
router.post('/multilingual/translate', validateBody(translateSchema), NlpController.translate);
router.post('/multilingual/ask', validateBody(crossLingualQaSchema), NlpController.askMultilingual);
router.post('/literature-review', validateBody(literatureReviewSchema), NlpController.literatureReview);
router.post('/warm-cache', NlpController.warmCache);

export default router;

