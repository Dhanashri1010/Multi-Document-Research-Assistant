import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NlpMultilingualService } from '../services/nlp/nlpMultilingualService.js';
import { NlpTopicService } from '../services/nlp/nlpTopicService.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';

vi.mock('../services/ai/llmService.js', () => ({
  LLMService: {
    generate: vi.fn().mockImplementation(async (prompt: string) => {
      if (prompt.includes('multilingual translator') || prompt.includes('Translate the following')) {
        return 'कृत्रिम बुद्धिमत्ता हे आधुनिक संगणक विज्ञानातील एक महत्त्वाचे क्षेत्र आहे.';
      }
      return 'Based on the provided English documents, the methodology incorporates dual-encoder architectures. [Document 1, Page 2]';
    }),
  },
}));

vi.mock('../models/NlpCache.js', () => ({
  NlpCacheService: {
    findOne: vi.fn().mockResolvedValue(null),
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
  },
  computeHash: vi.fn((obj: any) => JSON.stringify(obj).slice(0, 16)),
}));

describe('CO3: Multilingual NLP & Language Detection (franc)', () => {
  it('accurately distinguishes Marathi from Hindi, English, Spanish, and French', () => {
    const marathi = 'माहिती तंत्रज्ञान आणि कृत्रिम बुद्धिमत्ता क्षेत्रातील संशोधन खूप वेगाने प्रगती करत आहे.';
    const hindi = 'सूचना प्रौद्योगिकी और कृत्रिम बुद्धिमत्ता के क्षेत्र में अनुसंधान बहुत तेजी से प्रगति कर रहा है।';
    const english = 'Natural language processing enables machines to understand unstructured human text.';
    const spanish = 'El procesamiento del lenguaje natural permite a las máquinas comprender el texto.';
    const french = 'Le traitement automatique du langage naturel permet aux machines de comprendre les textes.';

    const marResult = NlpMultilingualService.detectLanguage(marathi);
    const hinResult = NlpMultilingualService.detectLanguage(hindi);
    const engResult = NlpMultilingualService.detectLanguage(english);
    const spaResult = NlpMultilingualService.detectLanguage(spanish);
    const fraResult = NlpMultilingualService.detectLanguage(french);

    expect(marResult.code).toBe('mar');
    expect(marResult.name).toBe('Marathi');

    expect(hinResult.code).toBe('hin');
    expect(hinResult.name).toBe('Hindi');

    expect(engResult.code).toBe('eng');
    expect(engResult.name).toBe('English');

    expect(spaResult.code).toBe('spa');
    expect(spaResult.name).toBe('Spanish');

    expect(fraResult.code).toBe('fra');
    expect(fraResult.name).toBe('French');
  });

  it('handles empty or blank input gracefully', () => {
    const res = NlpMultilingualService.detectLanguage('');
    expect(res.code).toBe('und');
    expect(res.name).toBe('Undetermined');
  });

  it('translates text using local dictionary fallback when offline or in test', async () => {
    const res = await NlpMultilingualService.translateText({
      text: 'Summary of the research methodology and results',
      targetLanguage: 'mr',
      provider: 'local',
    });

    expect(res.targetLanguage).toBe('mr');
    expect(res.translatedText).toContain('सारांश');
    expect(res.provider).toBe('local_fallback');
  });

  it('bypasses translation if source and target languages are identical', async () => {
    const res = await NlpMultilingualService.translateText({
      text: 'Hello world',
      targetLanguage: 'en',
      sourceLanguage: 'en',
    });

    expect(res.translatedText).toBe('Hello world');
    expect(res.latencyMs).toBeLessThan(10);
  });

  it('executes cross-lingual grounded QA on English documents', async () => {
    vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      limit: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          populate: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                documentId: { _id: 'doc123', title: 'RAG Architecture Paper' },
                chunkIndex: 1,
                pageNumber: 3,
                text: 'Dense retrieval combined with BM25 keyword matching yields high recall in scientific QA.',
              },
            ]),
          }),
        }),
      }),
    } as any);

    const questionInHindi = 'पुनर्प्राप्ति संवर्धित उत्पादन (RAG) प्रणाली कैसे काम करती है?';
    const result = await NlpMultilingualService.askCrossLingual({
      question: questionInHindi,
      targetLanguage: 'hi',
    });

    expect(result.detectedQuestionLanguage.code).toBe('hin');
    expect(result.retrievedPassages.length).toBeGreaterThan(0);
    expect(result.answer).toContain('RAG Architecture Paper');
  });
});

describe('CO3: Cross-Document Topic Modeling (K-Means, c-TF-IDF, PCA)', () => {
  it('throws helpful error when fewer than 10 embedded chunks exist', async () => {
    vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            { chunkIndex: 1, text: 'Hello', embedding: [0.1, 0.2] },
          ]),
        }),
      }),
    } as any);

    await expect(
      NlpTopicService.runTopicModeling({ k: 2 })
    ).rejects.toThrow(/At least 10 embedded text chunks are required/);
  });

  it('runs K-Means clustering, silhouette scoring, and c-TF-IDF on synthetic embeddings', async () => {
    // Generate 20 synthetic chunks split into 2 clear clusters in 4D space
    const syntheticChunks = Array.from({ length: 20 }, (_, i) => {
      const isClusterA = i < 10;
      const vec = isClusterA
        ? [1.0 + Math.random() * 0.1, 1.0 + Math.random() * 0.1, 0.0, 0.0]
        : [0.0, 0.0, 1.0 + Math.random() * 0.1, 1.0 + Math.random() * 0.1];
      const text = isClusterA
        ? `Machine learning neural network deep learning optimization algorithm ${i}`
        : `Database index storage query execution transaction throughput ${i}`;

      return {
        _id: `chunk_${i}`,
        documentId: { _id: isClusterA ? 'docA' : 'docB', title: isClusterA ? 'AI Paper' : 'DB Paper' },
        chunkIndex: i,
        text,
        embedding: vec,
      };
    });

    vi.spyOn(DocumentChunkModel, 'find').mockReturnValue({
      select: vi.fn().mockReturnValue({
        populate: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(syntheticChunks),
        }),
      }),
    } as any);

    const result = await NlpTopicService.runTopicModeling({ k: 2 });

    expect(result.k).toBe(2);
    expect(result.topics).toHaveLength(2);
    expect(result.points).toHaveLength(20);
    expect(result.silhouetteScore).toBeGreaterThan(0.5); // Clear clusters should yield high silhouette
    expect(result.topics[0].keywords.length).toBeGreaterThan(0);
    expect(result.documentDistributions.length).toBeGreaterThan(0);

    // Verify 2D PCA projections are bounded numbers
    for (const pt of result.points) {
      expect(typeof pt.x).toBe('number');
      expect(typeof pt.y).toBe('number');
      expect(isNaN(pt.x)).toBe(false);
      expect(isNaN(pt.y)).toBe(false);
      expect([0, 1]).toContain(pt.cluster);
    }
  });
});
