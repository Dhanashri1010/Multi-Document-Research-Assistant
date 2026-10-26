/**
 * Standard English Stopwords
 */
export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  'yourselves'
]);

/**
 * Lightweight, robust suffix stemmer for English vocabulary.
 */
export function stemToken(token: string): string {
  let w = token.toLowerCase();
  if (w.length <= 3) return w;

  // Step 1: Plurals
  if (w.endsWith('sses')) {
    w = w.slice(0, -2);
  } else if (w.endsWith('ies')) {
    w = w.slice(0, -3) + 'y';
  } else if (w.endsWith('ss')) {
    // keep ss
  } else if (w.endsWith('s') && !w.endsWith('us') && !w.endsWith('is')) {
    w = w.slice(0, -1);
  }

  if (w.length <= 3) return w;

  // Step 2: Derivational & inflectional suffixes
  if (w.endsWith('ational')) return w.slice(0, -7) + 'ate';
  if (w.endsWith('tional')) return w.slice(0, -6) + 'tion';
  if (w.endsWith('ization')) return w.slice(0, -7) + 'ize';
  if (w.endsWith('ation')) return w.slice(0, -5) + 'ate';
  if (w.endsWith('ator')) return w.slice(0, -4) + 'ate';
  if (w.endsWith('alism')) return w.slice(0, -5) + 'al';
  if (w.endsWith('iveness')) return w.slice(0, -7) + 'ive';
  if (w.endsWith('fulness')) return w.slice(0, -7) + 'ful';
  if (w.endsWith('ousness')) return w.slice(0, -7) + 'ous';
  if (w.endsWith('ment') && w.length > 6) return w.slice(0, -4);
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('er') && w.length > 4) return w.slice(0, -2);

  return w;
}

/**
 * Tokenizes text, filters stopwords, and applies stemming.
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  const rawWords = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const tokens: string[] = [];
  for (const word of rawWords) {
    if (!STOPWORDS.has(word)) {
      tokens.push(stemToken(word));
    }
  }
  return tokens;
}

export interface BM25Document {
  id: string;
  text: string;
}

export class BM25Index {
  private k1: number;
  private b: number;
  private docLengths: Map<string, number> = new Map();
  private docTermFreqs: Map<string, Map<string, number>> = new Map();
  private docFreqs: Map<string, number> = new Map();
  private numDocs: number = 0;
  private avgDocLength: number = 0;

  constructor(docs: BM25Document[], k1: number = 1.2, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
    this.buildIndex(docs);
  }

  private buildIndex(docs: BM25Document[]): void {
    this.numDocs = docs.length;
    let totalLength = 0;

    for (const doc of docs) {
      const tokens = tokenizeText(doc.text);
      const len = tokens.length;
      this.docLengths.set(doc.id, len);
      totalLength += len;

      const tfMap = new Map<string, number>();
      const seenInDoc = new Set<string>();

      for (const t of tokens) {
        tfMap.set(t, (tfMap.get(t) || 0) + 1);
        if (!seenInDoc.has(t)) {
          seenInDoc.add(t);
          this.docFreqs.set(t, (this.docFreqs.get(t) || 0) + 1);
        }
      }

      this.docTermFreqs.set(doc.id, tfMap);
    }

    this.avgDocLength = this.numDocs > 0 ? totalLength / this.numDocs : 1;
  }

  /**
   * Computes Okapi BM25 score for all indexed documents matching query.
   */
  public search(query: string, topK?: number): { id: string; score: number }[] {
    const queryTokens = tokenizeText(query);
    if (queryTokens.length === 0 || this.numDocs === 0) {
      return [];
    }

    const scores: { id: string; score: number }[] = [];

    for (const [docId, tfMap] of this.docTermFreqs.entries()) {
      let score = 0;
      const docLen = this.docLengths.get(docId) || 0;
      const lenNorm = 1 - this.b + this.b * (docLen / this.avgDocLength);

      for (const token of queryTokens) {
        const tf = tfMap.get(token) || 0;
        if (tf === 0) continue;

        const df = this.docFreqs.get(token) || 0;
        // Lucene/Standard BM25 smoothed IDF
        const idf = Math.log(1 + (this.numDocs - df + 0.5) / (df + 0.5));
        const termScore = idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * lenNorm));
        score += termScore;
      }

      if (score > 0) {
        scores.push({ id: docId, score });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return topK ? scores.slice(0, topK) : scores;
  }
}
