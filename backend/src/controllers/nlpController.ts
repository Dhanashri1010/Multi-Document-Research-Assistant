import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { NlpPreprocessingService } from '../services/nlp/nlpPreprocessingService.js';
import { NlpVectorizationService } from '../services/nlp/nlpVectorizationService.js';
import { NlpSentimentService } from '../services/nlp/nlpSentimentService.js';
import { NlpExtractionService } from '../services/nlp/nlpExtractionService.js';
import { NlpEvaluationService } from '../services/nlp/nlpEvaluationService.js';
import { LLMThrottleQueue } from '../services/ai/llmThrottleQueue.js';

export class NlpController {
  /**
   * POST /api/nlp/preprocess
   * Runs selectable preprocessing steps on document text.
   */
  static async preprocess(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, steps, rawText: customText, useCache = true } = req.body;

      let textToProcess = customText || '';
      let docId = documentId || 'ad_hoc';

      if (!textToProcess && documentId) {
        const doc = await DocumentModel.findById(documentId);
        if (!doc) {
          res.status(404).json({ error: `Document ${documentId} not found.` });
          return;
        }
        const chunks = await DocumentChunkModel.find({ documentId: doc._id })
          .sort({ chunkIndex: 1 })
          .select('text');
        textToProcess = chunks.map((c) => c.text).join('\n\n');
      }

      if (!textToProcess) {
        res.status(400).json({ error: 'No document text found to preprocess.' });
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
      res.status(500).json({ error: err.message || 'Preprocessing failed.' });
    }
  }

  /**
   * POST /api/nlp/vectorize
   * Generates TF-IDF keywords and pairwise cosine similarity matrices.
   */
  static async vectorize(req: Request, res: Response): Promise<void> {
    try {
      const { documentIds, useCache = true } = req.body;

      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ error: 'documentIds array is required.' });
        return;
      }

      if (documentIds.length > 10) {
        res.status(400).json({ error: 'Maximum 10 documents allowed for vectorization matrix.' });
        return;
      }

      const result = await NlpVectorizationService.vectorizeDocuments(documentIds, useCache);
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      console.error('[NlpController:vectorize] Error:', err);
      res.status(500).json({ error: err.message || 'Vectorization failed.' });
    }
  }

  /**
   * POST /api/nlp/sentiment
   * Dual-method sentiment analysis (Lexicon vs Gemini).
   */
  static async sentiment(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, runGemini = true, sampleSize = 35, useCache = true } = req.body;

      if (!documentId) {
        res.status(400).json({ error: 'documentId is required.' });
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
      res.status(500).json({ error: err.message || 'Sentiment analysis failed.' });
    }
  }

  /**
   * POST /api/nlp/extract
   * Information extraction (NER, Keyphrases, Structured Paper Schema).
   */
  static async extract(req: Request, res: Response): Promise<void> {
    try {
      const { documentId, runGemini = true, useCache = true } = req.body;

      if (!documentId) {
        res.status(400).json({ error: 'documentId is required.' });
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
      res.status(500).json({ error: err.message || 'Information extraction failed.' });
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
      res.status(500).json({ error: err.message || 'Evaluation run failed.' });
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
      res.status(500).json({ error: err.message || 'Failed to retrieve evaluation report.' });
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
}
