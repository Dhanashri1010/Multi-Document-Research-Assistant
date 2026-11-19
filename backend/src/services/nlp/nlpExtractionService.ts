import { z } from 'zod';
import { DocumentModel } from '../../models/Document.js';
import { DocumentChunkModel } from '../../models/DocumentChunk.js';
import { NlpCacheService, computeHash } from '../../models/NlpCache.js';
import { LLMService } from '../ai/llmService.js';
import { STOPWORDS } from './nlpPreprocessingService.js';

export type EntityType = 'PERSON' | 'ORG' | 'DATASET' | 'METRIC' | 'MODEL' | 'DATE' | 'LOCATION';

export interface ExtractedEntity {
  text: string;
  type: EntityType;
  source: 'rule-based' | 'gemini';
  start?: number;
  end?: number;
  confidence: number;
}

export interface Keyphrase {
  phrase: string;
  score: number;
}

export const StructuredPaperSchema = z.object({
  title: z.string().default('Untitled Research Paper'),
  authors: z.array(z.string()).default([]),
  year: z.number().nullable().optional(),
  objective: z.string().default('Not explicitly stated'),
  methods: z.array(z.string()).default([]),
  datasets: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  keyFindings: z.array(z.string()).default([]),
});

export type StructuredPaper = z.infer<typeof StructuredPaperSchema>;

export interface ExtractionResponse {
  documentId: string;
  documentTitle: string;
  entities: ExtractedEntity[];
  keyphrases: Keyphrase[];
  structuredData: StructuredPaper;
  samplePassage: string;
}

export class NlpExtractionService {
  /**
   * Rule-based Named Entity Recognition using high-precision patterns.
   */
  static extractEntitiesRuleBased(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seen = new Set<string>();

    const addEntity = (item: ExtractedEntity) => {
      const key = `${item.type}:${item.text.toLowerCase()}`;
      if (!seen.has(key) && item.text.trim().length >= 2) {
        seen.add(key);
        entities.push(item);
      }
    };

    // 1. DATE: Years (19xx, 20xx), Months + Years, or ISO dates
    const dateRegex = /\b(?:19\d{2}|20\d{2}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4})\b/g;
    let match: RegExpExecArray | null;
    while ((match = dateRegex.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'DATE',
        source: 'rule-based',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.95,
      });
    }

    // 2. METRIC: Accuracy, F1, BLEU, ROUGE, Perplexity, MAP, MRR, Latency, etc.
    const metricRegex = /\b(?:accuracy|F1(?:\-score)?|BLEU(?:-[1-4])?|ROUGE(?:-[1-2L])?|perplexity|precision|recall|AUC(?:-ROC)?|MAP|MRR|loss|latency|throughput|p99|WER)\b/gi;
    while ((match = metricRegex.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'METRIC',
        source: 'rule-based',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9,
      });
    }

    // 3. MODEL: BERT, GPT, Gemini, LLaMA, ResNet, Transformer, CNN, LSTM, etc.
    const modelRegex = /\b(?:GPT-[34o]+|BERT(?:-base|-large)?|RoBERTa|Gemini(?:-[\w.-]+)?|LLaMA(?:-[1-3])?|Claude|T5|BART|Mistral|DeepSeek|Transformer|CNN|LSTM|ResNet(?:-\d+)?|AutoEncoder)\b/g;
    while ((match = modelRegex.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'MODEL',
        source: 'rule-based',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.92,
      });
    }

    // 4. DATASET: SQuAD, GLUE, ImageNet, MS MARCO, HotpotQA, MultiRC, MNIST, etc.
    const datasetRegex = /\b(?:SQuAD(?:-v\d+)?|GLUE|SuperGLUE|ImageNet|MS\s*MARCO|HotpotQA|Natural\s*Questions|MultiRC|Common\s*Crawl|WikiText|MNIST|CIFAR(?:-10|-100)?)\b/gi;
    while ((match = datasetRegex.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'DATASET',
        source: 'rule-based',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.9,
      });
    }

    // 5. ORG: Google, OpenAI, DeepMind, Microsoft, Meta, Stanford, MIT, IEEE, etc.
    const orgRegex = /\b(?:Google(?:\s+DeepMind)?|OpenAI|Microsoft(?:\s+Research)?|Meta(?:\s+AI)?|Amazon|Apple|IBM|Stanford(?:\s+University)?|MIT|Berkeley|Carnegie\s+Mellon|Harvard|IEEE|ACM)\b/g;
    while ((match = orgRegex.exec(text)) !== null) {
      addEntity({
        text: match[0],
        type: 'ORG',
        source: 'rule-based',
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.88,
      });
    }

    // 6. PERSON: capitalized two-word names following common research author cues
    const personRegex = /(?:by|authors?|et\s+al\.?|proposed\s+by)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g;
    while ((match = personRegex.exec(text)) !== null) {
      addEntity({
        text: match[1],
        type: 'PERSON',
        source: 'rule-based',
        start: match.index + match[0].indexOf(match[1]),
        end: match.index + match[0].indexOf(match[1]) + match[1].length,
        confidence: 0.82,
      });
    }

    return entities;
  }

  /**
   * Keyphrase Extraction using simplified RAKE algorithm.
   */
  static extractKeyphrases(text: string, maxPhrases: number = 10): Keyphrase[] {
    // Split text into candidate phrases based on punctuation and stopwords
    const rawCandidates = text
      .split(/[.!?,;:()[\]{}"'\n]/)
      .map((p) => p.trim())
      .filter((p) => p.length > 3);

    const phraseScores = new Map<string, number>();

    for (const cand of rawCandidates) {
      const words = cand
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9-]/gi, ''))
        .filter(Boolean);

      // Extract continuous sequences of non-stop words (length 1 to 3 words)
      let currentSeq: string[] = [];
      for (const w of words) {
        if (STOPWORDS.has(w) || w.length < 3) {
          if (currentSeq.length > 0 && currentSeq.length <= 4) {
            const phrase = currentSeq.join(' ');
            phraseScores.set(phrase, (phraseScores.get(phrase) || 0) + currentSeq.length);
          }
          currentSeq = [];
        } else {
          currentSeq.push(w);
        }
      }
      if (currentSeq.length > 0 && currentSeq.length <= 4) {
        const phrase = currentSeq.join(' ');
        phraseScores.set(phrase, (phraseScores.get(phrase) || 0) + currentSeq.length);
      }
    }

    const sorted = Array.from(phraseScores.entries())
      .map(([phrase, score]) => ({ phrase, score }))
      .sort((a, b) => b.score - a.score);

    return sorted.slice(0, maxPhrases);
  }

  /**
   * End-to-end information extraction: NER, Keyphrases, and Zod Structured Schema.
   */
  static async extractDocument(
    documentId: string,
    options: { runGemini?: boolean } = {},
    useCache: boolean = true
  ): Promise<ExtractionResponse> {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found.`);
    }

    const runGemini = options.runGemini ?? true;
    const cacheKey = doc._id.toString();
    const contentHash = computeHash(doc.title + (doc.abstract || '') + doc.chunkCount);
    const paramsHash = computeHash({ runGemini });
    const promptVersion = 'v1.0';
    const model = runGemini ? 'rule-based-and-gemini' : 'rule-based-only';

    if (useCache) {
      const cached = await NlpCacheService.findOne({
        documentId: cacheKey,
        contentHash,
        task: 'ner_extraction',
        paramsHash,
        promptVersion,
        model,
      });
      if (cached?.result) {
        return cached.result as ExtractionResponse;
      }
    }

    // Sample passage: Front matter chunks + overview (up to 3000 chars)
    const chunks = await DocumentChunkModel.find({ documentId: doc._id })
      .sort({ chunkIndex: 1 })
      .limit(6)
      .select('text');

    const samplePassage = chunks.map((c) => c.text).join('\n\n').slice(0, 4000);

    // 1. Rule-based NER
    const ruleEntities = this.extractEntitiesRuleBased(samplePassage);

    // 2. Keyphrase Extraction
    const keyphrases = this.extractKeyphrases(samplePassage, 12);

    // 3. Structured Data Initialization with existing document metadata
    let structuredData: StructuredPaper = {
      title: doc.title || doc.originalName,
      authors: doc.authors || [],
      year: doc.year || null,
      objective: doc.abstract || 'Document overview and retrieval study',
      methods: [],
      datasets: [],
      metrics: [],
      keyFindings: [],
    };

    let allEntities = [...ruleEntities];

    // Populate structuredData fallback from ruleEntities if empty
    if (structuredData.methods.length === 0) {
      structuredData.methods = Array.from(new Set(ruleEntities.filter((e) => e.type === 'MODEL').map((e) => e.text)));
    }
    if (structuredData.datasets.length === 0) {
      structuredData.datasets = Array.from(new Set(ruleEntities.filter((e) => e.type === 'DATASET').map((e) => e.text)));
    }
    if (structuredData.metrics.length === 0) {
      structuredData.metrics = Array.from(new Set(ruleEntities.filter((e) => e.type === 'METRIC').map((e) => e.text)));
    }
    if (!structuredData.year) {
      const yearEntity = ruleEntities.find((e) => e.type === 'DATE' && /^\d{4}$/.test(e.text));
      if (yearEntity) {
        structuredData.year = parseInt(yearEntity.text, 10);
      }
    }

    // 4. Gemini Structured NER and Paper Information Extraction
    if (runGemini) {
      try {
        const prompt = `You are an expert NLP scientific information extraction system.
Extract structured metadata and named entities from the scientific text below.

Text Excerpt:
${samplePassage}

Extract:
1. Named Entities across: PERSON, ORG, DATASET, METRIC, MODEL, DATE, LOCATION.
2. Structured Paper details according to schema: title, authors, year, objective, methods, datasets, metrics, keyFindings.

Respond with STRICT JSON format:
{
  "entities": [
    {
      "text": "BERT",
      "type": "MODEL",
      "confidence": 0.95
    }
  ],
  "structuredData": {
    "title": "Paper title",
    "authors": ["Author 1", "Author 2"],
    "year": 2024,
    "objective": "Primary research objective",
    "methods": ["Method 1", "Method 2"],
    "datasets": ["Dataset 1"],
    "metrics": ["F1", "Accuracy"],
    "keyFindings": ["Finding 1", "Finding 2"]
  }
}`;

        const rawJson = await LLMService.generate(prompt, {
          temperature: 0.1,
          systemPrompt: 'You are an accurate scientific information extraction system. Output strictly valid JSON.',
        });

        const parsed = this.parseJsonSafe(rawJson);

        if (parsed?.entities && Array.isArray(parsed.entities)) {
          const geminiEntities: ExtractedEntity[] = parsed.entities.map((e: any) => ({
            text: String(e.text || '').trim(),
            type: this.normalizeEntityType(e.type),
            source: 'gemini' as const,
            confidence: typeof e.confidence === 'number' ? Math.round(e.confidence * 100) / 100 : 0.9,
          }));

          // Merge without duplicate keys
          const existingKeys = new Set(allEntities.map((e) => `${e.type}:${e.text.toLowerCase()}`));
          for (const ge of geminiEntities) {
            const k = `${ge.type}:${ge.text.toLowerCase()}`;
            if (!existingKeys.has(k) && ge.text.length >= 2) {
              existingKeys.add(k);
              allEntities.push(ge);
            }
          }
        }

        if (parsed?.structuredData) {
          const validationResult = StructuredPaperSchema.safeParse(parsed.structuredData);
          if (validationResult.success) {
            structuredData = validationResult.data;
          }
        }
      } catch (geminiErr: any) {
        console.warn(`[NlpExtractionService] Gemini extraction failed, using rule-based entities: ${geminiErr.message}`);
      }
    }

    const response: ExtractionResponse = {
      documentId: doc._id.toString(),
      documentTitle: doc.title || doc.originalName,
      entities: allEntities,
      keyphrases,
      structuredData,
      samplePassage: samplePassage.slice(0, 1500),
    };

    if (useCache) {
      await NlpCacheService.findOneAndUpdate(
        { documentId: cacheKey, contentHash, task: 'ner_extraction', paramsHash, promptVersion, model },
        { result: response },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    return response;
  }

  private static normalizeEntityType(type: string): EntityType {
    const upper = String(type || '').toUpperCase();
    if (['PERSON', 'ORG', 'DATASET', 'METRIC', 'MODEL', 'DATE', 'LOCATION'].includes(upper)) {
      return upper as EntityType;
    }
    return 'MODEL';
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
