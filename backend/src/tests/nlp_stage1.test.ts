import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NlpPreprocessingService } from '../services/nlp/nlpPreprocessingService.js';
import { NlpVectorizationService } from '../services/nlp/nlpVectorizationService.js';
import { NlpSentimentService } from '../services/nlp/nlpSentimentService.js';
import { NlpExtractionService, StructuredPaperSchema } from '../services/nlp/nlpExtractionService.js';
import { NlpEvaluationService } from '../services/nlp/nlpEvaluationService.js';
import { LLMThrottleQueue } from '../services/ai/llmThrottleQueue.js';
import { LLMService } from '../services/ai/llmService.js';

describe('Stage 1: NLP Preprocessing, Vectorization, Sentiment & Evaluation Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    LLMThrottleQueue.reset();
  });

  describe('1. CO1 Text Preprocessing Pipeline', () => {
    it('executes all 8 pipeline cleaning steps and calculates comprehensive statistics', async () => {
      const rawText = `
        Page 1
        Proceedings of IEEE Conference 2024
        The deep trans-
        former architecture achieves state-of-the-art results [1, 2] on the SQuAD benchmark!
        Check our code at https://github.com/sample/repo or contact author@stanford.edu.
        Page 2
      `;

      const result = await NlpPreprocessingService.preprocess(rawText, undefined, 'ad_hoc', false);

      expect(result.rawStats.charCount).toBeGreaterThan(0);
      expect(result.cleanedStats.charCount).toBeLessThan(result.rawStats.charCount);
      expect(result.reductionRatioPercent).toBeGreaterThan(0);
      expect(result.stopwordsRemovedCount).toBeGreaterThan(0);

      // Noise removed
      expect(result.cleanedText).not.toContain('https://github.com');
      expect(result.cleanedText).not.toContain('author@stanford.edu');
      expect(result.cleanedText).not.toContain('[1, 2]');

      // De-hyphenation: "trans-\nformer" -> stemmed "transform"
      expect(result.cleanedText).toContain('transform');

      // Header/footer stripped
      expect(result.cleanedText).not.toContain('Page 1');

      // Top terms generated
      expect(result.topTerms.length).toBeGreaterThan(0);
      expect(result.topTerms[0]).toHaveProperty('term');
      expect(result.topTerms[0]).toHaveProperty('count');
    });

    it('handles selective pipeline step toggling', async () => {
      const sample = 'The Deep Learning Model.';
      // Run with lowercase disabled
      const result = await NlpPreprocessingService.preprocess(
        sample,
        { lowercase: false, stopwordRemoval: false, stemming: false },
        'ad_hoc',
        false
      );

      expect(result.cleanedText).toContain('Deep');
      expect(result.cleanedText).toContain('Learning');
    });
  });

  describe('2. CO1 Vectorization & Cosine Similarity', () => {
    it('calculates TF-IDF terms and builds sparse cosine similarity', async () => {
      // Mock documents in database
      const mockDocs = [
        { _id: 'doc1', title: 'Attention Transformers', originalName: 'doc1.pdf' },
        { _id: 'doc2', title: 'Convolutional Vision', originalName: 'doc2.pdf' },
      ];

      const { DocumentModel } = await import('../models/Document.js');
      const { DocumentChunkModel } = await import('../models/DocumentChunk.js');

      vi.spyOn(DocumentModel, 'find').mockResolvedValue(mockDocs as any);
      vi.spyOn(DocumentChunkModel, 'find').mockImplementation(((query: any) => ({
        select: vi.fn().mockResolvedValue(
          query.documentId === 'doc1'
            ? [{ text: 'attention transformer multihead self-attention mechanism', embedding: [0.1, 0.2] }]
            : [{ text: 'convolutional filter feature map pooling layer', embedding: [0.9, 0.8] }]
        ),
      })) as any);

      const result = await NlpVectorizationService.vectorizeDocuments(['doc1', 'doc2'], false);

      expect(result.documents).toHaveLength(2);
      expect(result.documents[0].topTerms.length).toBeGreaterThan(0);
      expect(result.matrix.length).toBe(4); // 2x2 matrix

      // Self-similarity on diagonal must be 1.0
      const selfA = result.matrix.find((c) => c.docAId === 'doc1' && c.docBId === 'doc1');
      const selfB = result.matrix.find((c) => c.docAId === 'doc2' && c.docBId === 'doc2');
      expect(selfA?.tfidfSimilarity).toBeCloseTo(1.0, 1);
      expect(selfB?.tfidfSimilarity).toBeCloseTo(1.0, 1);
    });
  });

  describe('3. CO2 Sentiment Analysis Engine', () => {
    it('correctly classifies positive, neutral, and negative text using Lexicon (AFINN)', () => {
      const pos = NlpSentimentService.analyzeSentenceLexicon(
        'Our novel architecture achieves remarkable breakthrough results and superb accuracy.'
      );
      expect(pos.label).toBe('positive');
      expect(pos.score).toBeGreaterThan(0);

      const neg = NlpSentimentService.analyzeSentenceLexicon(
        'The baseline completely failed with severe memory crashes and unacceptable degradation.'
      );
      expect(neg.label).toBe('negative');
      expect(neg.score).toBeLessThan(0);

      const neu = NlpSentimentService.analyzeSentenceLexicon(
        'The batch size was set to 64 sequences across 8 compute nodes.'
      );
      expect(neu.label).toBe('neutral');
    });

    it('runs dual-method sentiment analysis with mocked Gemini', async () => {
      const { DocumentModel } = await import('../models/Document.js');
      const { DocumentChunkModel } = await import('../models/DocumentChunk.js');

      vi.spyOn(DocumentModel, 'findById').mockResolvedValue({
        _id: 'doc_sent',
        title: 'Sentiment Paper',
        chunkCount: 2,
      } as any);

      vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { text: 'We achieved an outstanding 95% accuracy score. The system is extremely fast.', pageNumber: 1 },
            { text: 'However, memory leakage causes occasional server crashes under high concurrency.', pageNumber: 2 },
          ]),
        }),
      } as any);

      vi.spyOn(LLMService, 'generate').mockResolvedValue(
        JSON.stringify({
          classifications: [
            { id: 1, label: 'positive', confidence: 0.95, rationale: 'Reports high accuracy' },
            { id: 2, label: 'negative', confidence: 0.9, rationale: 'Mentions memory leakage' },
          ],
        })
      );

      const result = await NlpSentimentService.analyzeDocument('doc_sent', { runGemini: true }, false);

      expect(result.documentTitle).toBe('Sentiment Paper');
      expect(result.lexiconStats).toBeDefined();
      expect(result.geminiStats).toBeDefined();
      expect(result.agreementRatePct).toBeGreaterThanOrEqual(0);
      expect(result.mostPositive.length).toBeGreaterThan(0);
      expect(result.mostNegative.length).toBeGreaterThan(0);
    });
  });

  describe('4. CO2 Information Extraction & NER', () => {
    it('extracts named entities via high-precision rule-based patterns', () => {
      const text = `
        In 2024, researchers at Google DeepMind trained BERT and Transformer on SQuAD to optimize F1-score and accuracy.
        The paper proposed by John Smith at Stanford University evaluated latency.
      `;

      const entities = NlpExtractionService.extractEntitiesRuleBased(text);
      const types = new Set(entities.map((e) => e.type));

      expect(types).toContain('DATE');
      expect(types).toContain('ORG');
      expect(types).toContain('MODEL');
      expect(types).toContain('DATASET');
      expect(types).toContain('METRIC');
      expect(types).toContain('PERSON');
    });

    it('extracts keyphrases using RAKE algorithm', () => {
      const text = 'Retrieval augmented generation systems improve factual question answering accuracy in large language models.';
      const keyphrases = NlpExtractionService.extractKeyphrases(text, 5);

      expect(keyphrases.length).toBeGreaterThan(0);
      expect(keyphrases[0]).toHaveProperty('phrase');
      expect(keyphrases[0]).toHaveProperty('score');
    });

    it('validates structured paper schema with Zod', () => {
      const validData = {
        title: 'Attention Is All You Need',
        authors: ['Ashish Vaswani', 'Noam Shazeer'],
        year: 2017,
        objective: 'Propose self-attention architecture',
        methods: ['Transformer', 'Self-Attention'],
        datasets: ['WMT 2014 English-to-German'],
        metrics: ['BLEU'],
        keyFindings: ['Outperforms recurrent and convolutional models'],
      };

      const parsed = StructuredPaperSchema.safeParse(validData);
      expect(parsed.success).toBe(true);
    });
  });

  describe('5. LLM Throttle Queue & Quota Limits', () => {
    it('tracks request count and enforces 10 RPM spacing and daily limits', async () => {
      const initialQuota = LLMThrottleQueue.getQuotaStatus();
      expect(initialQuota.dailyLimit).toBe(500);
      expect(initialQuota.maxRpm).toBe(10);
      expect(initialQuota.isExhausted).toBe(false);

      // Acquire capacity
      await LLMThrottleQueue.acquire();
      const updatedQuota = LLMThrottleQueue.getQuotaStatus();
      expect(updatedQuota.dailyUsage).toBe(1);
      expect(updatedQuota.remainingDaily).toBe(499);
    });
  });

  describe('6. CO2 Gold Standard Empirical Evaluation', () => {
    it('evaluates sentiment and NER benchmarks and generates confusion matrix', async () => {
      // Mock Gemini for evaluation calls
      vi.spyOn(LLMService, 'generate').mockImplementation(async (prompt: string) => {
        if (prompt.includes('Classify the sentiment')) {
          // Return simulated classifications matching sample IDs
          return JSON.stringify({
            classifications: [
              { id: 1, label: 'positive' },
              { id: 2, label: 'positive' },
              { id: 16, label: 'neutral' },
              { id: 33, label: 'negative' },
            ],
          });
        }
        if (prompt.includes('Extract named entities')) {
          return JSON.stringify({
            results: [
              {
                id: 1,
                entities: [
                  { text: 'BERT', type: 'MODEL' },
                  { text: 'SQuAD', type: 'DATASET' },
                  { text: '2020', type: 'DATE' },
                ],
              },
            ],
          });
        }
        return '{}';
      });

      const report = await NlpEvaluationService.runEvaluation({ forceRefresh: true });

      expect(report.sentiment.datasetSize).toBeGreaterThanOrEqual(50);
      expect(report.sentiment.lexicon.accuracy).toBeGreaterThan(0);
      expect(report.sentiment.lexicon.confusionMatrix).toHaveLength(9); // 3x3 matrix

      expect(report.sentiment.gemini.confusionMatrix).toHaveLength(9);
      expect(report.sentiment.gemini.macroF1).toBeDefined();

      expect(report.entities.datasetSize).toBeGreaterThanOrEqual(20);
      expect(report.entities.ruleBased.exactMatch).toHaveProperty('f1');
      expect(report.entities.ruleBased.partialMatch).toHaveProperty('f1');
      expect(report.entities.gemini.exactMatch).toHaveProperty('f1');
    });
  });
});

