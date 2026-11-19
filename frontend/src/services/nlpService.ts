import { apiClient } from './api.js';

export interface PreprocessingPipelineSteps {
  unicodeNormalization?: boolean;
  lowercase?: boolean;
  noiseRemoval?: boolean;
  headerFooterRemoval?: boolean;
  hyphenationRepair?: boolean;
  tokenization?: boolean;
  stopwordRemoval?: boolean;
  stemming?: boolean;
}

export interface TextStatistics {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  tokenCount: number;
  vocabSize: number;
}

export interface TermFrequency {
  term: string;
  count: number;
}

export interface PreprocessingResult {
  rawText: string;
  cleanedText: string;
  stepsApplied: PreprocessingPipelineSteps;
  rawStats: TextStatistics;
  cleanedStats: TextStatistics;
  reductionRatioPercent: number;
  stopwordsRemovedCount: number;
  topTerms: TermFrequency[];
  tokens: string[];
  sentences: string[];
}

export interface TfIdfTerm {
  term: string;
  tfidf: number;
  tf: number;
  df: number;
}

export interface DocumentTfIdfResult {
  documentId: string;
  title: string;
  topTerms: TfIdfTerm[];
}

export interface SimilarityMatrixCell {
  docAId: string;
  docATitle: string;
  docBId: string;
  docBTitle: string;
  tfidfSimilarity: number;
  denseSimilarity: number;
}

export interface VectorizationResponse {
  documents: DocumentTfIdfResult[];
  matrix: SimilarityMatrixCell[];
  vocabularySize: number;
  comparisonInsight: string;
}

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SentenceSentiment {
  sentenceIndex: number;
  text: string;
  pageNumber?: number;
  lexicon: {
    score: number;
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

export interface StructuredPaper {
  title: string;
  authors: string[];
  year?: number | null;
  objective: string;
  methods: string[];
  datasets: string[];
  metrics: string[];
  keyFindings: string[];
}

export interface ExtractionResponse {
  documentId: string;
  documentTitle: string;
  entities: ExtractedEntity[];
  keyphrases: Keyphrase[];
  structuredData: StructuredPaper;
  samplePassage: string;
}

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

export interface LLMQuotaStatus {
  dailyUsage: number;
  dailyLimit: number;
  remainingDaily: number;
  rpmUsage: number;
  maxRpm: number;
  isNearLimit: boolean;
  isExhausted: boolean;
  resetTimeUtc: string;
}

export class NlpService {
  static async preprocessText(payload: {
    documentId?: string;
    rawText?: string;
    steps?: PreprocessingPipelineSteps;
    useCache?: boolean;
  }): Promise<PreprocessingResult> {
    const res = await apiClient.post<{ success: boolean; data: PreprocessingResult }>('/nlp/preprocess', payload);
    return res.data.data;
  }

  static async vectorizeDocuments(documentIds: string[], useCache: boolean = true): Promise<VectorizationResponse> {
    const res = await apiClient.post<{ success: boolean; data: VectorizationResponse }>('/nlp/vectorize', {
      documentIds,
      useCache,
    });
    return res.data.data;
  }

  static async analyzeSentiment(
    documentId: string,
    options: { runGemini?: boolean; sampleSize?: number; useCache?: boolean } = {}
  ): Promise<SentimentAnalysisResponse> {
    const res = await apiClient.post<{ success: boolean; data: SentimentAnalysisResponse }>('/nlp/sentiment', {
      documentId,
      ...options,
    });
    return res.data.data;
  }

  static async extractInformation(
    documentId: string,
    options: { runGemini?: boolean; useCache?: boolean } = {}
  ): Promise<ExtractionResponse> {
    const res = await apiClient.post<{ success: boolean; data: ExtractionResponse }>('/nlp/extract', {
      documentId,
      ...options,
    });
    return res.data.data;
  }

  static async runEvaluation(forceRefresh: boolean = true): Promise<NlpEvaluationReport> {
    const res = await apiClient.post<{ success: boolean; data: NlpEvaluationReport }>('/nlp/evaluation/run', {
      forceRefresh,
    });
    return res.data.data;
  }

  static async getEvaluationReport(): Promise<NlpEvaluationReport | null> {
    const res = await apiClient.get<{ success: boolean; data: NlpEvaluationReport | null }>('/nlp/evaluation/results');
    return res.data.data;
  }

  static async getLlmQuota(): Promise<LLMQuotaStatus> {
    const res = await apiClient.get<{ success: boolean; data: LLMQuotaStatus }>('/nlp/llm-quota');
    return res.data.data;
  }
}
