import natural from 'natural';
import { DocumentModel } from '../../models/Document.js';
import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { NlpCacheService, computeHash } from '../../models/NlpCache.js';
import { LLMService } from '../ai/llmService.js';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SentenceSentiment {
  sentenceIndex: number;
  text: string;
  pageNumber?: number;
  lexicon: {
    score: number; // Normalized -1.0 to 1.0
    label: SentimentLabel;
  };
  gemini?: {
    label: SentimentLabel;
    confidence: number;
    rationale?: string;
  };
}

export interface MethodSentimentStats {
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  overallScore: number;
  overallLabel: SentimentLabel;
}

export interface SentimentAnalysisResponse {
  documentId: string;
  documentTitle: string;
  totalSentences: number;
  lexiconStats: MethodSentimentStats;
  geminiStats?: MethodSentimentStats;
  agreementRatePct?: number;
  mostPositive: SentenceSentiment[];
  mostNegative: SentenceSentiment[];
  sampleSentences: SentenceSentiment[];
}

export class NlpSentimentService {
  private static analyzer = new natural.SentimentAnalyzer(
    'English',
    natural.PorterStemmer,
    'afinn'
  );

  /**
   * Evaluates a single sentence with the Lexicon (AFINN-based) analyzer.
   */
  static analyzeSentenceLexicon(sentence: string): { score: number; label: SentimentLabel } {
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(sentence) || [];
    if (tokens.length === 0) {
      return { score: 0, label: 'neutral' };
    }

    const rawScore = this.analyzer.getSentiment(tokens);
    // AFINN raw score is average valence per token, typically -5 to +5
    const normalized = Math.max(-1, Math.min(1, rawScore));

    let label: SentimentLabel = 'neutral';
    if (normalized > 0.08) label = 'positive';
    else if (normalized < -0.08) label = 'negative';

    return {
      score: Math.round(normalized * 100) / 100,
      label,
    };
  }

  /**
   * Analyzes document sentiment using both Lexicon (AFINN) and Gemini structured JSON.
   */
  static async analyzeDocument(
    documentId: string,
    options: { runGemini?: boolean; sampleSize?: number } = {},
    useCache: boolean = true
  ): Promise<SentimentAnalysisResponse> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found.`);
    }

    const runGemini = options.runGemini ?? true;
    const sampleSize = options.sampleSize ?? 40; // Analyze representative sample sentences

    const cacheKey = doc._id.toString();
    const contentHash = computeHash(doc.title + (doc.abstract || '') + doc.chunkCount);
    const paramsHash = computeHash({ runGemini, sampleSize });
    const promptVersion = 'v1.0';
    const model = runGemini ? 'lexicon-afinn-and-gemini' : 'lexicon-afinn-only';

    if (useCache) {
      const cached = await NlpCacheService.findOne({
        documentId: cacheKey,
        contentHash,
        task: 'sentiment',
        paramsHash,
        promptVersion,
        model,
      });
      if (cached?.result) {
        return cached.result as SentimentAnalysisResponse;
      }
    }

    // 1. Gather sentences from chunks with page numbers
    const chunks = await DocumentChunkModel.find({ documentId: doc._id })
      .select('text pageNumber')
      .limit(30);

    const sentenceTokenizer = new (natural as any).SentenceTokenizer();
    const allSentenceItems: { text: string; pageNumber?: number }[] = [];

    for (const chunk of chunks) {
      const sents = sentenceTokenizer.tokenize(chunk.text) || [];
      for (const s of sents) {
        const clean = s.trim();
        // Skip formula-only or tiny noise sentences
        if (clean.length > 25 && /[a-zA-Z]{3,}/.test(clean)) {
          allSentenceItems.push({
            text: clean,
            pageNumber: chunk.pageNumber,
          });
        }
      }
    }

    // Sample evenly across the document
    const step = Math.max(1, Math.floor(allSentenceItems.length / sampleSize));
    const sampledItems = allSentenceItems.filter((_, idx) => idx % step === 0).slice(0, sampleSize);

    // 2. Lexicon Analysis
    const sentenceResults: SentenceSentiment[] = sampledItems.map((item, idx) => {
      const lex = this.analyzeSentenceLexicon(item.text);
      return {
        sentenceIndex: idx + 1,
        text: item.text,
        pageNumber: item.pageNumber,
        lexicon: lex,
      };
    });

    // 3. Optional Gemini Structured JSON Batch Analysis (at most 1 batch of 35-40 items)
    if (runGemini && sentenceResults.length > 0) {
      try {
        const sentencePayload = sentenceResults.map((s) => ({
          id: s.sentenceIndex,
          text: s.text,
        }));

        const prompt = `You are a rigorous NLP sentiment classification system.
Analyze the sentiment of each scientific/research sentence below.
Classify each as "positive", "neutral", or "negative" with a confidence score between 0.0 and 1.0.
Sentences reporting experimental success, breakthroughs, or significant improvements are "positive".
Sentences reporting errors, vulnerabilities, limitations, high latency, or degradation are "negative".
Factual architecture descriptions or neutral setup details are "neutral".

Sentences:
${JSON.stringify(sentencePayload, null, 2)}

Respond with STRICT JSON in the following format:
{
  "classifications": [
    {
      "id": 1,
      "label": "positive" | "neutral" | "negative",
      "confidence": 0.95,
      "rationale": "Reports 15% improvement in accuracy"
    }
  ]
}`;

        const rawJson = await LLMService.generate(prompt, {
          temperature: 0.1,
          systemPrompt: 'You are an objective scientific sentiment analyzer. Return valid JSON only.',
        });

        const parsed = this.parseJsonSafe(rawJson);
        if (parsed?.classifications && Array.isArray(parsed.classifications)) {
          const geminiMap = new Map<number, any>();
          for (const item of parsed.classifications) {
            geminiMap.set(item.id, item);
          }

          for (const s of sentenceResults) {
            const g = geminiMap.get(s.sentenceIndex);
            if (g) {
              const label: SentimentLabel =
                g.label === 'positive' || g.label === 'negative' ? g.label : 'neutral';
              s.gemini = {
                label,
                confidence: typeof g.confidence === 'number' ? Math.round(g.confidence * 100) / 100 : 0.85,
                rationale: g.rationale || '',
              };
            }
          }
        }
      } catch (geminiErr: any) {
        console.warn(`[NlpSentimentService] Gemini batch analysis failed, relying on Lexicon: ${geminiErr.message}`);
      }
    }

    // 4. Compute Aggregate Stats
    const total = sentenceResults.length || 1;

    // Lexicon Stats
    let lexPos = 0, lexNeu = 0, lexNeg = 0, lexSum = 0;
    for (const s of sentenceResults) {
      if (s.lexicon.label === 'positive') lexPos++;
      else if (s.lexicon.label === 'negative') lexNeg++;
      else lexNeu++;
      lexSum += s.lexicon.score;
    }
    const lexAvg = Math.round((lexSum / total) * 100) / 100;
    const lexiconStats: MethodSentimentStats = {
      positiveCount: lexPos,
      neutralCount: lexNeu,
      negativeCount: lexNeg,
      positivePct: Math.round((lexPos / total) * 1000) / 10,
      neutralPct: Math.round((lexNeu / total) * 1000) / 10,
      negativePct: Math.round((lexNeg / total) * 1000) / 10,
      overallScore: lexAvg,
      overallLabel: lexAvg > 0.05 ? 'positive' : lexAvg < -0.05 ? 'negative' : 'neutral',
    };

    // Gemini Stats & Agreement Rate
    let geminiStats: MethodSentimentStats | undefined;
    let agreementRatePct: number | undefined;

    const withGemini = sentenceResults.filter((s) => s.gemini);
    if (withGemini.length > 0) {
      let gPos = 0, gNeu = 0, gNeg = 0;
      let matching = 0;

      for (const s of withGemini) {
        if (s.gemini!.label === 'positive') gPos++;
        else if (s.gemini!.label === 'negative') gNeg++;
        else gNeu++;

        if (s.gemini!.label === s.lexicon.label) {
          matching++;
        }
      }

      const gTotal = withGemini.length;
      agreementRatePct = Math.round((matching / gTotal) * 1000) / 10;
      geminiStats = {
        positiveCount: gPos,
        neutralCount: gNeu,
        negativeCount: gNeg,
        positivePct: Math.round((gPos / gTotal) * 1000) / 10,
        neutralPct: Math.round((gNeu / gTotal) * 1000) / 10,
        negativePct: Math.round((gNeg / gTotal) * 1000) / 10,
        overallScore: Math.round(((gPos - gNeg) / gTotal) * 100) / 100,
        overallLabel: gPos > gNeg ? 'positive' : gNeg > gPos ? 'negative' : 'neutral',
      };
    }

    // 5. Identify Most Positive and Most Negative
    const sortedByLex = [...sentenceResults].sort((a, b) => b.lexicon.score - a.lexicon.score);
    const mostPositive = sortedByLex.slice(0, 3);
    const mostNegative = [...sentenceResults].sort((a, b) => a.lexicon.score - b.lexicon.score).slice(0, 3);

    const response: SentimentAnalysisResponse = {
      documentId: doc._id.toString(),
      documentTitle: doc.title || doc.originalName,
      totalSentences: total,
      lexiconStats,
      geminiStats,
      agreementRatePct,
      mostPositive,
      mostNegative,
      sampleSentences: sentenceResults.slice(0, 15),
    };

    if (useCache) {
      await NlpCacheService.findOneAndUpdate(
        { documentId: cacheKey, contentHash, task: 'sentiment', paramsHash, promptVersion, model },
        { result: response },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    return response;
  }

  private static parseJsonSafe(text: string): any {
    try {
      const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }
}
