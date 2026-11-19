import natural from 'natural';
import { NlpCacheService, computeHash } from '../../models/NlpCache.js';

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

export interface TermFrequency {
  term: string;
  count: number;
}

export interface TextStatistics {
  charCount: number;
  wordCount: number;
  sentenceCount: number;
  tokenCount: number;
  vocabSize: number;
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

export const DEFAULT_PIPELINE_STEPS: Required<PreprocessingPipelineSteps> = {
  unicodeNormalization: true,
  lowercase: true,
  noiseRemoval: true,
  headerFooterRemoval: true,
  hyphenationRepair: true,
  tokenization: true,
  stopwordRemoval: true,
  stemming: true,
};

// Curated comprehensive English stopwords
export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into',
  'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s',
  'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re',
  'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t',
  'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
  'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself',
  'yourselves', 'et', 'al', 'figure', 'fig', 'table', 'section', 'also', 'using', 'used', 'paper'
]);

export class NlpPreprocessingService {
  /**
   * Applies selected preprocessing steps and returns detailed statistics.
   */
  static async preprocess(
    rawText: string,
    steps: PreprocessingPipelineSteps = DEFAULT_PIPELINE_STEPS,
    documentId: string = 'ad_hoc',
    useCache: boolean = true
  ): Promise<PreprocessingResult> {
    const activeSteps: Required<PreprocessingPipelineSteps> = {
      ...DEFAULT_PIPELINE_STEPS,
      ...steps,
    };

    const contentHash = computeHash(rawText);
    const paramsHash = computeHash(activeSteps);
    const promptVersion = 'v1.0';
    const model = 'natural-porter';

    if (useCache && documentId !== 'ad_hoc') {
      const cached = await NlpCacheService.findOne({
        documentId,
        contentHash,
        task: 'preprocessing',
        paramsHash,
        promptVersion,
        model,
      });
      if (cached?.result) {
        return cached.result as PreprocessingResult;
      }
    }

    // 1. Raw Stats
    const rawTokens = this.tokenizeWords(rawText);
    const rawSentences = this.splitSentences(rawText);
    const rawStats: TextStatistics = {
      charCount: rawText.length,
      wordCount: rawTokens.length,
      sentenceCount: rawSentences.length,
      tokenCount: rawTokens.length,
      vocabSize: new Set(rawTokens.map((t) => t.toLowerCase())).size,
    };

    // 2. Preprocessing pipeline
    let text = rawText;

    if (activeSteps.unicodeNormalization) {
      // NFKC replaces compatible characters, fractions, and ligatures (e.g. ﬁ -> fi)
      text = text.normalize('NFKC');
    }

    if (activeSteps.hyphenationRepair) {
      // Re-join hyphenated words across linebreaks: "trans-\nformer" -> "transformer"
      text = text.replace(/([a-zA-Z]+)-\s*\n\s*([a-zA-Z]+)/g, '$1$2');
    }

    if (activeSteps.headerFooterRemoval) {
      // Remove lines matching "Page X", standalone numbers, or common header patterns
      text = text
        .split('\n')
        .filter((line) => !/^\s*(?:page\s+)?\d+\s*$/i.test(line))
        .filter((line) => !/^\s*(?:proceedings|conference|ieee|arxiv|springer|acm)[\s\d:.-]*$/i.test(line))
        .join('\n');
    }

    if (activeSteps.noiseRemoval) {
      // Remove URLs, emails, citation brackets [1-4], and non-standard control characters
      text = text
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi, '')
        .replace(/\[\d+(?:[–,-]\d+)*\]/g, '') // remove citation markers like [1], [2, 3]
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/[^\w\s.,;:?!'"()\-–—]/g, ' ');
    }

    if (activeSteps.lowercase) {
      text = text.toLowerCase();
    }

    // Tokenization
    let tokens = activeSteps.tokenization ? this.tokenizeWords(text) : text.split(/\s+/).filter(Boolean);
    let stopwordsRemovedCount = 0;

    if (activeSteps.stopwordRemoval) {
      const filtered: string[] = [];
      for (const tok of tokens) {
        const lower = tok.toLowerCase();
        if (STOPWORDS.has(lower) || lower.length < 2) {
          stopwordsRemovedCount++;
        } else {
          filtered.push(tok);
        }
      }
      tokens = filtered;
    }

    if (activeSteps.stemming) {
      tokens = tokens.map((t) => natural.PorterStemmer.stem(t));
    }

    // Cleaned Text reconstructed from processed tokens/sentences
    const cleanedText = tokens.join(' ');
    const cleanedSentences = this.splitSentences(text);

    // Compute top terms
    const freqMap = new Map<string, number>();
    for (const t of tokens) {
      freqMap.set(t, (freqMap.get(t) || 0) + 1);
    }

    const topTerms: TermFrequency[] = Array.from(freqMap.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const cleanedStats: TextStatistics = {
      charCount: cleanedText.length,
      wordCount: tokens.length,
      sentenceCount: cleanedSentences.length,
      tokenCount: tokens.length,
      vocabSize: freqMap.size,
    };

    const reductionRatioPercent =
      rawStats.charCount > 0
        ? Math.round(((rawStats.charCount - cleanedStats.charCount) / rawStats.charCount) * 1000) / 10
        : 0;

    const result: PreprocessingResult = {
      rawText: rawText.slice(0, 5000), // Return excerpt for diff preview
      cleanedText: cleanedText.slice(0, 5000),
      stepsApplied: activeSteps,
      rawStats,
      cleanedStats,
      reductionRatioPercent,
      stopwordsRemovedCount,
      topTerms,
      tokens: tokens.slice(0, 100), // First 100 sample tokens
      sentences: cleanedSentences.slice(0, 20),
    };

    if (useCache && documentId !== 'ad_hoc') {
      await NlpCacheService.findOneAndUpdate(
        { documentId, contentHash, task: 'preprocessing', paramsHash, promptVersion, model },
        { result },
        { upsert: true, new: true }
      ).catch(() => {});
    }

    return result;
  }

  private static tokenizeWords(text: string): string[] {
    const tokenizer = new natural.WordTokenizer();
    return tokenizer.tokenize(text) || [];
  }

  private static splitSentences(text: string): string[] {
    const sentenceTokenizer = new (natural as any).SentenceTokenizer();
    return sentenceTokenizer.tokenize(text) || [];
  }
}
