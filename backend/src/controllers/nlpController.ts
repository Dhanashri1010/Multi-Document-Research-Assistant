import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { NlpPreprocessingService } from '../services/nlp/nlpPreprocessingService.js';
import { NlpVectorizationService } from '../services/nlp/nlpVectorizationService.js';
import { NlpSentimentService } from '../services/nlp/nlpSentimentService.js';
import { NlpExtractionService } from '../services/nlp/nlpExtractionService.js';
import { NlpEvaluationService } from '../services/nlp/nlpEvaluationService.js';
import { NlpTopicService } from '../services/nlp/nlpTopicService.js';
import { NlpMultilingualService } from '../services/nlp/nlpMultilingualService.js';
import { NlpLiteratureReviewService } from '../services/nlp/nlpLiteratureReviewService.js';
import {
  ragQaPromptV1,
  ragQaPromptV2,
  documentSummaryPromptV2,
  comparisonMatrixPromptV2,
  entityExtractionPromptV1,
  topicNamingPromptV1,
  crossLingualQaPromptV1,
  literatureReviewPromptV1,
} from '../prompts/index.js';
import { LLMThrottleQueue } from '../services/ai/llmThrottleQueue.js';
import { formatSafeErrorMessage } from '../services/ai/llmService.js';

export class NlpController {
  /**
   * POST /api/nlp/preprocess
   * Runs selectable preprocessing steps on document text.
   */
  static async preprocess(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, steps, rawText: customText, useCache = true } = req.body;
      const userId = req.user?.userId;

      let textToProcess = customText || '';
      let docId = documentId || 'ad_hoc';

      if (!textToProcess && documentId) {
        const docQuery: any = { _id: documentId };
        if (userId) docQuery.userId = userId;
        const doc = await DocumentModel.findOne(docQuery);
        if (!doc) {
          res.status(404).json({
            success: false,
            error: 'Document not found',
            message: `Document ${documentId} could not be found or belongs to another user.`,
          });
          return;
        }
        const chunks = await DocumentChunkModel.find({ documentId: doc._id })
          .sort({ chunkIndex: 1 })
          .select('text');
        textToProcess = chunks.map((c) => c.text).join('\n\n');
      }

      if (!textToProcess) {
        res.status(400).json({
          success: false,
          error: 'Missing text content',
          message: 'No document text was provided or found to analyze.',
        });
        return;
      }

      const result = await NlpPreprocessingService.preprocess(
        textToProcess,
        steps,
        docId,
        useCache
      );

      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:preprocess] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Preprocessing error',
        message: err.message || 'An error occurred during text preprocessing.',
      });
    }
  }

  /**
   * POST /api/nlp/vectorize
   * Generates TF-IDF keywords and pairwise cosine similarity matrices.
   */
  static async vectorize(req: Request, res: Response): Promise<void> {
    try {
      const { documentIds, useCache = true } = req.body;
      const userId = req.user?.userId;

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'documentIds array is required.',
        });
        return;
      }

      if (documentIds.length > 10) {
        res.status(400).json({
          success: false,
          error: 'Limit exceeded',
          message: 'Maximum 10 documents allowed for vectorization matrix comparison.',
        });
        return;
      }

      if (userId) {
        const count = await DocumentModel.countDocuments({ _id: { $in: documentIds }, userId });
        if (count === 0) {
          res.status(404).json({
            success: false,
            error: 'Documents not found',
            message: 'None of the requested documents were found in your library.',
          });
          return;
        }
      }

      const result = await NlpVectorizationService.vectorizeDocuments(documentIds, useCache);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:vectorize] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Vectorization error',
        message: err.message || 'Vectorization comparison failed.',
      });
    }
  }

  /**
   * POST /api/nlp/sentiment
   * Dual-method sentiment analysis (Lexicon vs Gemini).
   */
  static async sentiment(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, runGemini = true, sampleSize = 35, useCache = true } = req.body;
      const userId = req.user?.userId;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'documentId is required.',
        });
        return;
      }

      const docQuery: any = { _id: documentId };
      if (userId) docQuery.userId = userId;
      const doc = await DocumentModel.findOne(docQuery);
      if (!doc) {
        res.status(404).json({
          success: false,
          error: 'Document not found',
          message: `Document ${documentId} could not be found in your library.`,
        });
        return;
      }

      const result = await NlpSentimentService.analyzeDocument(
        documentId,
        { runGemini, sampleSize },
        useCache
      );

      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:sentiment] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Sentiment error',
        message: err.message || 'Sentiment analysis failed.',
      });
    }
  }

  /**
   * POST /api/nlp/extract
   * Information extraction (NER, Keyphrases, Structured Paper Schema).
   */
  static async extract(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, runGemini = true, useCache = true } = req.body;
      const userId = req.user?.userId;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'documentId is required.',
        });
        return;
      }

      const docQuery: any = { _id: documentId };
      if (userId) docQuery.userId = userId;
      const doc = await DocumentModel.findOne(docQuery);
      if (!doc) {
        res.status(404).json({
          success: false,
          error: 'Document not found',
          message: `Document ${documentId} could not be found in your library.`,
        });
        return;
      }

      const result = await NlpExtractionService.extractDocument(
        documentId,
        { runGemini },
        useCache
      );

      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:extract] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Extraction error',
        message: err.message || 'Information extraction failed.',
      });
    }
  }

  /**
   * POST /api/nlp/evaluation/run
   * Executes the gold standard evaluation benchmark.
   */
  static async runEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const { forceRefresh = true } = req.body;
      const report = await NlpEvaluationService.runEvaluation({ forceRefresh });
      res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      console.error('[NlpController:runEvaluation] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Evaluation error',
        message: err.message || 'Evaluation benchmark run failed.',
      });
    }
  }

  /**
   * GET /api/nlp/evaluation/results
   * Retrieves cached benchmark results without re-running.
   */
  static async getEvaluationReport(_req: Request, res: Response): Promise<void> {
    try {
      const report = await NlpEvaluationService.getCachedReport();
      res.status(200).json({ success: true, data: report });
    } catch (err: any) {
      console.error('[NlpController:getEvaluationReport] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Evaluation report error',
        message: err.message || 'Failed to retrieve evaluation report.',
      });
    }
  }

  /**
   * GET /api/nlp/llm-quota
   * Returns current Gemini rate limit and daily request quota telemetry.
   */
  static getLlmQuota(_req: Request, res: Response): void {
    const status = LLMThrottleQueue.getQuotaStatus();
    res.status(200).json({ success: true, data: status });
  }

  /**
   * POST /api/nlp/topics
   * Cross-document K-Means topic modeling with c-TF-IDF, silhouette and PCA 2D coordinates.
   */
  static async topics(req: Request, res: Response): Promise<void> {
    try {
      const { documentIds, k, sampleMax, generateAiTitles, forceRefresh } = req.body;
      const userId = req.user?.userId;

      if (documentIds && documentIds.length > 0 && userId) {
        const count = await DocumentModel.countDocuments({ _id: { $in: documentIds }, userId });
        if (count === 0) {
          res.status(404).json({
            success: false,
            error: 'Documents not found',
            message: 'None of the specified documents were found in your library.',
          });
          return;
        }
      }

      const result = await NlpTopicService.runTopicModeling({
        documentIds,
        k: k ? parseInt(k, 10) : undefined,
        sampleMax: sampleMax ? parseInt(sampleMax, 10) : undefined,
        generateAiTitles: Boolean(generateAiTitles),
        forceRefresh: Boolean(forceRefresh),
        userId,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:topics] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Topic modeling error',
        message: err.message || 'Topic modeling analysis failed.',
      });
    }
  }

  /**
   * POST /api/nlp/multilingual/detect
   * Language identification via franc.
   */
  static async detectLanguage(req: Request, res: Response): Promise<void> {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'Text string is required for language detection.',
        });
        return;
      }
      const result = NlpMultilingualService.detectLanguage(text);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:detectLanguage] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Language detection error',
        message: err.message || 'Language detection failed.',
      });
    }
  }

  /**
   * POST /api/nlp/multilingual/translate
   * Text translation via Google Cloud Translation API (REST) or Gemini fallback.
   */
  static async translate(req: Request, res: Response): Promise<void> {
    try {
      const { text, targetLanguage, sourceLanguage, provider, forceRefresh } = req.body;
      if (!text || !targetLanguage) {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'Both text and targetLanguage are required.',
        });
        return;
      }
      const result = await NlpMultilingualService.translateText({
        text,
        targetLanguage,
        sourceLanguage,
        provider,
        forceRefresh,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:translate] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Translation error',
        message: err.message || 'Translation failed.',
      });
    }
  }

  /**
   * POST /api/nlp/multilingual/ask
   * Cross-lingual grounded Q&A.
   */
  static async askMultilingual(req: Request, res: Response): Promise<void> {
    try {
      const { question, documentIds, targetLanguage } = req.body;
      const userId = req.user?.userId;

      if (!question) {
        res.status(400).json({
          success: false,
          error: 'Invalid input',
          message: 'Question is required.',
        });
        return;
      }

      if (documentIds && documentIds.length > 0 && userId) {
        const count = await DocumentModel.countDocuments({ _id: { $in: documentIds }, userId });
        if (count === 0) {
          res.status(404).json({
            success: false,
            error: 'Documents not found',
            message: 'None of the specified documents were found in your library.',
          });
          return;
        }
      }

      const result = await NlpMultilingualService.askCrossLingual({
        question,
        documentIds,
        targetLanguage,
        userId,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:askMultilingual] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Cross-lingual QA error',
        message: err.message || 'Cross-lingual QA failed.',
      });
    }
  }

  /**
   * GET /api/nlp/prompts
   * Returns metadata and rationales for all versioned prompt templates in the library.
   */
  static listPrompts(_req: Request, res: Response): void {
    const prompts = [
      ragQaPromptV1,
      ragQaPromptV2,
      documentSummaryPromptV2,
      comparisonMatrixPromptV2,
      entityExtractionPromptV1,
      topicNamingPromptV1,
      crossLingualQaPromptV1,
      literatureReviewPromptV1,
    ].map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      author: p.author,
      purpose: p.purpose,
      strategy: p.strategy,
      variables: p.variables,
      rationale: p.rationale,
      template: p.template,
    }));
    res.status(200).json({ success: true, data: prompts });
  }

  /**
   * POST /api/nlp/literature-review
   * Synthesizes 2 to 5 research papers into an academic literature review with page citations.
   */
  static async literatureReview(req: Request, res: Response): Promise<void> {
    try {
      const { documentIds, forceRefresh } = req.body;
      const userId = req.user?.userId;

      if (!Array.isArray(documentIds) || documentIds.length < 2) {
        res.status(400).json({
          success: false,
          error: 'Invalid selection',
          message: 'At least 2 document IDs are required for a multi-document literature review.',
        });
        return;
      }

      if (userId) {
        const count = await DocumentModel.countDocuments({ _id: { $in: documentIds }, userId });
        if (count < 2) {
          res.status(404).json({
            success: false,
            error: 'Documents not found',
            message: 'Could not find at least 2 valid documents belonging to your library from the selected IDs.',
          });
          return;
        }
      }

      const result = await NlpLiteratureReviewService.generateReview({
        documentIds,
        forceRefresh,
        userId,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:literatureReview] Error:', err);
      const safeMessage = formatSafeErrorMessage(err);
      res.status(500).json({
        success: false,
        error: 'Literature review error',
        message: safeMessage,
      });
    }
  }

  /**
   * POST /api/nlp/warm-cache
   * Warms cache for live demo on available documents.
   */
  static async warmCache(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const docQuery: any = { status: 'ready' };
      if (userId) docQuery.userId = userId;

      const docs = await DocumentModel.find(docQuery).limit(3).select('_id');
      const docIds = docs.map((d) => d._id.toString());
      const tasksRun: string[] = [];

      if (docIds.length > 0) {
        // Warm vectorization
        await NlpVectorizationService.vectorizeDocuments(docIds, false).catch(() => {});
        tasksRun.push('vectorization');

        // Warm sentiment on first doc (Lexicon only to be quota-safe)
        await NlpSentimentService.analyzeDocument(docIds[0], { runGemini: false }, false).catch(() => {});
        tasksRun.push('sentiment_lexicon');

        // Warm extraction on first doc
        await NlpExtractionService.extractDocument(docIds[0], { runGemini: false }, false).catch(() => {});
        tasksRun.push('extraction_rules');

        // Warm topic modeling
        await NlpTopicService.runTopicModeling({ documentIds: docIds, forceRefresh: false, userId }).catch(() => {});
        tasksRun.push('topic_modeling');
      }

      // Warm evaluation benchmark
      await NlpEvaluationService.runEvaluation({ forceRefresh: false }).catch(() => {});
      tasksRun.push('evaluation_benchmarks');

      res.status(200).json({
        success: true,
        message: 'Cache warmed successfully for fast responses.',
        tasks: tasksRun,
      });
    } catch (err: any) {
      console.error('[NlpController:warmCache] Error:', err);
      res.status(500).json({
        success: false,
        error: 'Warm cache error',
        message: err.message || 'Failed to warm cache.',
      });
    }
  }
}

