import fs from 'fs';
import path from 'path';
import { NlpCacheModel, NlpCacheService, computeHash } from '../../models/NlpCache.js';
import { NlpSentimentService, SentimentLabel } from './nlpSentimentService.js';
import { NlpExtractionService, ExtractedEntity } from './nlpExtractionService.js';
import { LLMService } from '../ai/llmService.js';

export interface ConfusionMatrixCell {
  gold: SentimentLabel;
  predicted: SentimentLabel;
  count: number;
}

export interface MetricSummary {
  accuracy: number;
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  latencyMs: number;
}

export interface NerMetrics {
  exactMatch: {
    precision: number;
    recall: number;
    f1: number;
  };
  partialMatch: {
    precision: number;
    recall: number;
    f1: number;
  };
  totalGoldEntities: number;
  totalPredictedEntities: number;
  latencyMs: number;
}

export interface NlpEvaluationReport {
  evaluatedAt: string;
  sentiment: {
    datasetSize: number;
    lexicon: MetricSummary & { confusionMatrix: ConfusionMatrixCell[] };
    gemini: MetricSummary & { confusionMatrix: ConfusionMatrixCell[] };
  };
  entities: {
    datasetSize: number;
    ruleBased: NerMetrics;
    gemini: NerMetrics;
  };
}

export class NlpEvaluationService {
  private static getGoldDir(): string {
    const candidate1 = path.resolve(process.cwd(), 'eval');
    if (fs.existsSync(path.join(candidate1, 'sentiment_gold.json'))) {
      return candidate1;
    }
    const candidate2 = path.resolve(process.cwd(), 'backend', 'eval');
    if (fs.existsSync(path.join(candidate2, 'sentiment_gold.json'))) {
      return candidate2;
    }
    return candidate1;
  }

  /**
   * Retrieves cached evaluation report or returns null if not yet run.
   */
  static async getCachedReport(): Promise<NlpEvaluationReport | null> {
    const cached = await NlpCacheService.findOne({
      documentId: 'gold_standard_benchmark',
      task: 'evaluation_benchmark',
      promptVersion: 'v1.0',
    });

    return cached ? (cached.result as NlpEvaluationReport) : null;
  }

  /**
   * Runs the full evaluation benchmark across gold standard datasets.
   * Batches Gemini calls into at most 2-3 requests and caches the final results.
   */
  static async runEvaluation(options: { forceRefresh?: boolean } = {}): Promise<NlpEvaluationReport> {
    if (!options.forceRefresh) {
      const cached = await this.getCachedReport();
      if (cached) return cached;
    }

    const goldDir = this.getGoldDir();
    const sentimentGoldPath = path.join(goldDir, 'sentiment_gold.json');
    const entitiesGoldPath = path.join(goldDir, 'entities_gold.json');

    if (!fs.existsSync(sentimentGoldPath) || !fs.existsSync(entitiesGoldPath)) {
      throw new Error('Gold evaluation datasets not found under backend/eval.');
    }

    const sentimentGold: { id: number; text: string; gold: SentimentLabel }[] = JSON.parse(
      await fs.promises.readFile(sentimentGoldPath, 'utf-8')
    );
    const entitiesGold: { id: number; passage: string; goldEntities: { text: string; type: string }[] }[] =
      JSON.parse(await fs.promises.readFile(entitiesGoldPath, 'utf-8'));

    // ==========================================
    // 1. SENTIMENT EVALUATION (LEXICON vs GEMINI)
    // ==========================================
    // Method A: Lexicon (AFINN)
    const lexStart = performance.now();
    const lexPredictions: SentimentLabel[] = sentimentGold.map((item) => {
      const res = NlpSentimentService.analyzeSentenceLexicon(item.text);
      return res.label;
    });
    const lexLatency = Math.round(performance.now() - lexStart);

    // Method B: Gemini (batched into 2 requests: 26 items each)
    const geminiStart = performance.now();
    const geminiPredictions: SentimentLabel[] = [];
    const batchSize = 26;

    for (let i = 0; i < sentimentGold.length; i += batchSize) {
      const batch = sentimentGold.slice(i, i + batchSize);
      try {
        const payload = batch.map((item) => ({ id: item.id, text: item.text }));
        const prompt = `Classify the sentiment of each scientific/research sentence as "positive", "neutral", or "negative".
Sentences:
${JSON.stringify(payload, null, 2)}

Respond with STRICT JSON format:
{
  "classifications": [
    { "id": 1, "label": "positive" | "neutral" | "negative" }
  ]
}`;
        const rawJson = await LLMService.generate(prompt, {
          temperature: 0.1,
          systemPrompt: 'You are an objective scientific benchmark classifier. Output valid JSON only.',
        });
        const parsed = this.parseJsonSafe(rawJson);
        const map = new Map<number, SentimentLabel>();
        if (parsed?.classifications && Array.isArray(parsed.classifications)) {
          for (const c of parsed.classifications) {
            const l = c.label === 'positive' || c.label === 'negative' ? c.label : 'neutral';
            map.set(c.id, l);
          }
        }
        for (const item of batch) {
          geminiPredictions.push(map.get(item.id) || 'neutral');
        }
      } catch (err: any) {
        console.warn(`[NlpEvaluationService] Gemini batch sentiment failed, fallback to neutral: ${err.message}`);
        for (let j = 0; j < batch.length; j++) geminiPredictions.push('neutral');
      }
    }
    const geminiSentimentLatency = Math.round(performance.now() - geminiStart);

    const goldLabels = sentimentGold.map((item) => item.gold);
    const lexMetrics = this.computeClassificationMetrics(goldLabels, lexPredictions, lexLatency);
    const geminiMetrics = this.computeClassificationMetrics(goldLabels, geminiPredictions, geminiSentimentLatency);

    // ==========================================
    // 2. NER EVALUATION (RULE-BASED vs GEMINI)
    // ==========================================
    // Method A: Rule-Based NER
    const ruleNerStart = performance.now();
    const ruleNerPredictions: ExtractedEntity[][] = entitiesGold.map((item) =>
      NlpExtractionService.extractEntitiesRuleBased(item.passage)
    );
    const ruleNerLatency = Math.round(performance.now() - ruleNerStart);

    // Method B: Gemini NER (single batch of 21 short passages)
    const geminiNerStart = performance.now();
    const geminiNerPredictions: ExtractedEntity[][] = [];

    try {
      const nerPayload = entitiesGold.map((item) => ({ id: item.id, passage: item.passage }));
      const nerPrompt = `Extract named entities from each passage. Allowed entity types: PERSON, ORG, DATASET, METRIC, MODEL, DATE, LOCATION.
Passages:
${JSON.stringify(nerPayload, null, 2)}

Respond with STRICT JSON:
{
  "results": [
    {
      "id": 1,
      "entities": [
        { "text": "BERT", "type": "MODEL" }
      ]
    }
  ]
}`;
      const nerRawJson = await LLMService.generate(nerPrompt, {
        temperature: 0.1,
        systemPrompt: 'You are an accurate scientific NER evaluator. Output strictly valid JSON.',
      });
      const parsedNer = this.parseJsonSafe(nerRawJson);
      const nerMap = new Map<number, ExtractedEntity[]>();

      if (parsedNer?.results && Array.isArray(parsedNer.results)) {
        for (const res of parsedNer.results) {
          const list: ExtractedEntity[] = (res.entities || []).map((e: any) => ({
            text: String(e.text || '').trim(),
            type: e.type,
            source: 'gemini',
            confidence: 0.95,
          }));
          nerMap.set(res.id, list);
        }
      }

      for (const item of entitiesGold) {
        geminiNerPredictions.push(nerMap.get(item.id) || []);
      }
    } catch (nerErr: any) {
      console.warn(`[NlpEvaluationService] Gemini NER batch failed: ${nerErr.message}`);
      for (let k = 0; k < entitiesGold.length; k++) geminiNerPredictions.push([]);
    }
    const geminiNerLatency = Math.round(performance.now() - geminiNerStart);

    const allGoldEntitySets = entitiesGold.map((item) => item.goldEntities);
    const ruleNerScores = this.computeNerMetrics(allGoldEntitySets, ruleNerPredictions, ruleNerLatency);
    const geminiNerScores = this.computeNerMetrics(allGoldEntitySets, geminiNerPredictions, geminiNerLatency);

    const report: NlpEvaluationReport = {
      evaluatedAt: new Date().toISOString(),
      sentiment: {
        datasetSize: sentimentGold.length,
        lexicon: lexMetrics,
        gemini: geminiMetrics,
      },
      entities: {
        datasetSize: entitiesGold.length,
        ruleBased: ruleNerScores,
        gemini: geminiNerScores,
      },
    };

    // Cache the benchmark report
    await NlpCacheService.findOneAndUpdate(
      {
        documentId: 'gold_standard_benchmark',
        contentHash: computeHash(JSON.stringify(sentimentGold) + JSON.stringify(entitiesGold)),
        task: 'evaluation_benchmark',
        paramsHash: 'default',
        promptVersion: 'v1.0',
        model: 'benchmark-evaluator',
      },
      { result: report },
      { upsert: true, new: true }
    );

    return report;
  }

  private static computeClassificationMetrics(
    gold: SentimentLabel[],
    predicted: SentimentLabel[],
    latencyMs: number
  ): MetricSummary & { confusionMatrix: ConfusionMatrixCell[] } {
    const labels: SentimentLabel[] = ['positive', 'neutral', 'negative'];
    const total = gold.length;
    let correct = 0;

    // Build 3x3 Confusion Matrix
    const matrixMap = new Map<string, number>();
    for (const g of labels) {
      for (const p of labels) {
        matrixMap.set(`${g}->${p}`, 0);
      }
    }

    for (let i = 0; i < total; i++) {
      if (gold[i] === predicted[i]) {
        correct++;
      }
      const key = `${gold[i]}->${predicted[i]}`;
      matrixMap.set(key, (matrixMap.get(key) || 0) + 1);
    }

    const accuracy = Math.round((correct / total) * 1000) / 10;

    // Per-class Precision, Recall, and F1
    const precisions: number[] = [];
    const recalls: number[] = [];
    const f1s: number[] = [];

    for (const label of labels) {
      const tp = matrixMap.get(`${label}->${label}`) || 0;
      let totalPredictedAsLabel = 0;
      let totalGoldAsLabel = 0;

      for (const l of labels) {
        totalPredictedAsLabel += matrixMap.get(`${l}->${label}`) || 0;
        totalGoldAsLabel += matrixMap.get(`${label}->${l}`) || 0;
      }

      const precision = totalPredictedAsLabel > 0 ? tp / totalPredictedAsLabel : 0;
      const recall = totalGoldAsLabel > 0 ? tp / totalGoldAsLabel : 0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      precisions.push(precision);
      recalls.push(recall);
      f1s.push(f1);
    }

    const macroPrecision = Math.round((precisions.reduce((a, b) => a + b, 0) / 3) * 1000) / 10;
    const macroRecall = Math.round((recalls.reduce((a, b) => a + b, 0) / 3) * 1000) / 10;
    const macroF1 = Math.round((f1s.reduce((a, b) => a + b, 0) / 3) * 1000) / 10;

    const confusionMatrix: ConfusionMatrixCell[] = [];
    for (const g of labels) {
      for (const p of labels) {
        confusionMatrix.push({
          gold: g,
          predicted: p,
          count: matrixMap.get(`${g}->${p}`) || 0,
        });
      }
    }

    return {
      accuracy,
      macroPrecision,
      macroRecall,
      macroF1,
      latencyMs,
      confusionMatrix,
    };
  }

  private static computeNerMetrics(
    goldPassages: { text: string; type: string }[][],
    predictedPassages: ExtractedEntity[][],
    latencyMs: number
  ): NerMetrics {
    let exactMatches = 0;
    let partialMatches = 0;
    let totalGold = 0;
    let totalPred = 0;

    for (let i = 0; i < goldPassages.length; i++) {
      const goldList = goldPassages[i] || [];
      const predList = predictedPassages[i] || [];

      totalGold += goldList.length;
      totalPred += predList.length;

      for (const pred of predList) {
        const predText = pred.text.toLowerCase().trim();
        const predType = String(pred.type).toUpperCase();

        // Exact match: matching text and type
        const exact = goldList.some(
          (g) => g.text.toLowerCase().trim() === predText && g.type.toUpperCase() === predType
        );
        if (exact) {
          exactMatches++;
        }

        // Partial match: substring overlap with matching type
        const partial = goldList.some((g) => {
          const gt = g.text.toLowerCase().trim();
          return (gt.includes(predText) || predText.includes(gt)) && g.type.toUpperCase() === predType;
        });
        if (partial) {
          partialMatches++;
        }
      }
    }

    const calcPRF = (matches: number) => {
      const p = totalPred > 0 ? matches / totalPred : 0;
      const r = totalGold > 0 ? matches / totalGold : 0;
      const f1 = p + r > 0 ? (2 * p * r) / (p + r) : 0;
      return {
        precision: Math.round(p * 1000) / 10,
        recall: Math.round(r * 1000) / 10,
        f1: Math.round(f1 * 1000) / 10,
      };
    };

    return {
      exactMatch: calcPRF(exactMatches),
      partialMatch: calcPRF(partialMatches),
      totalGoldEntities: totalGold,
      totalPredictedEntities: totalPred,
      latencyMs,
    };
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
