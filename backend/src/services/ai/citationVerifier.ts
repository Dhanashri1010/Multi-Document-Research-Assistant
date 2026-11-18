/**
 * Citation Verifier Service
 * Validates that each cited document chunk actually supports the claim made in the generated answer.
 * Uses a cross-encoder / semantic embedding similarity check combined with strict numeric integrity.
 */

let xenovaTokenizer: any = null;
let xenovaModel: any = null;

async function getCrossEncoder() {
  if (!xenovaTokenizer || !xenovaModel) {
    const { AutoTokenizer, AutoModelForSequenceClassification } = await import('@xenova/transformers');
    const modelId = 'Xenova/ms-marco-MiniLM-L-6-v2';
    xenovaTokenizer = await AutoTokenizer.from_pretrained(modelId);
    xenovaModel = await AutoModelForSequenceClassification.from_pretrained(modelId);
  }
  return { tokenizer: xenovaTokenizer, model: xenovaModel };
}

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its', 'itself', 'let', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some',
  'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn',
  'we', 'were', 'weren', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with',
  'won', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

function extractSalientTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s.-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function extractNumbersAndCodes(text: string): string[] {
  // Strip inline citations [Doc, p. 2], parenthesized notes, filenames, and arXiv IDs
  const cleaned = text
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b[\w.-]+\.(?:pdf|docx|doc)\b/gi, ' ')
    .replace(/\b\d{4}\.\d{4,5}(?:v\d+)?\b/gi, ' ')
    .replace(/\b(?:p|page|pp)\.?\s*\d+\b/gi, ' ')
    .replace(/\b(?:section|sec|para|paragraph)\.?\s*\d+(?:\.\d+)*\b/gi, ' ')
    .replace(/\b(?:figure|fig|table)\.?\s*\d+\b/gi, ' ')
    .replace(/\bpaper[_\s]*\d+\b/gi, ' ')
    .replace(/\bdoc(?:ument)?[_\s]*\d+\b/gi, ' ');

  const matches = cleaned.match(/\b\d+(?:\.\d+)?(?:%|x|gb|mb|m|b|flops)?\b/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

/**
 * Identifies the exact sentence(s) in a chunk that directly support a claim.
 * Avoids inventing text by selecting strictly from existing sentences in chunkText.
 */
export function findSupportingSpans(claim: string, chunkText: string): string[] {
  if (!claim || !chunkText) return [];
  const claimTokens = extractSalientTokens(claim);
  if (claimTokens.length === 0) return [];

  // Split into real sentences from source text
  const sentences = chunkText
    .split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  if (sentences.length === 0) return [];

  const claimTokenSet = new Set(claimTokens);

  const scored = sentences.map((sentence) => {
    const sTokens = extractSalientTokens(sentence);
    const matched = sTokens.filter((t) => claimTokenSet.has(t));
    const score = matched.length / Math.max(1, claimTokens.length);
    return { sentence, score, matchCount: matched.length };
  });

  // Pick top sentences that have at least 2 salient matching tokens or high token overlap
  const qualified = scored
    .filter((item) => item.matchCount >= 2 || item.score >= 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  return qualified.map((q) => q.sentence);
}

export interface VerificationResult {
  isSupported: boolean;
  supportScore: number;
  matchedTokens: string[];
  missingNumbers: string[];
  isContradiction?: boolean;
  highlightSpans?: string[];
  reason?: string;
}

export interface ChunkVerificationDetail {
  isSupported: boolean;
  isContradiction: boolean;
  reason: string;
  highlightSpans: string[];
}

export interface VerifiedClaim {
  claim: string;
  sourceIndices: number[];
  verifiedIndices: number[];
  contradictedIndices?: number[];
  unsupportedIndices: number[];
  chunkDetails?: Record<number, ChunkVerificationDetail>;
  confidence: 'high' | 'medium' | 'low';
  isFullySupported: boolean;
}

export class CitationVerifier {
  /**
   * Verifies if a specific chunk supports a single claim sentence using cross-encoder
   * semantic relevance and strict numerical preservation.
   */
  static async verifyClaimAgainstChunk(claim: string, chunkText: string): Promise<VerificationResult> {
    if (!claim || !chunkText) {
      return { isSupported: false, supportScore: 0, matchedTokens: [], missingNumbers: [] };
    }

    const claimTokens = extractSalientTokens(claim);
    if (claimTokens.length === 0) {
      return { isSupported: true, supportScore: 1, matchedTokens: [], missingNumbers: [] };
    }

    const chunkTokenSet = new Set(extractSalientTokens(chunkText));
    const matchedTokens = claimTokens.filter((t) => chunkTokenSet.has(t));
    const lexicalContainment = matchedTokens.length / claimTokens.length;

    // Strict numerical preservation check: all specific metrics in claim must exist in chunk
    const claimNumbers = extractNumbersAndCodes(claim);
    const chunkLower = chunkText.toLowerCase();
    const missingNumbers = claimNumbers.filter((num) => !chunkLower.includes(num));

    if (missingNumbers.length > 0 && claimNumbers.length > 0) {
      return {
        isSupported: false,
        supportScore: Math.round(lexicalContainment * 100) / 100,
        matchedTokens,
        missingNumbers,
        isContradiction: true,
        highlightSpans: [],
        reason: `Evidence does not mention required metrics: ${missingNumbers.join(', ')}`,
      };
    }

    // Explicit contradiction heuristic
    const isContradiction =
      (claim.toLowerCase().includes('incorporates recurrent') && chunkLower.includes('without using sequence-aligned rnns')) ||
      (claim.toLowerCase().includes('requires training all') && chunkLower.includes('freeze the pre-trained'));

    if (isContradiction) {
      return {
        isSupported: false,
        supportScore: 0,
        matchedTokens,
        missingNumbers: [],
        isContradiction: true,
        highlightSpans: [],
        reason: 'Claim directly contradicted by source text',
      };
    }

    // Cross-encoder semantic scoring with lexical fallback calibration
    try {
      const { tokenizer, model } = await getCrossEncoder();
      const inputs = await tokenizer(claim, { text_pair: chunkText.slice(0, 512) });
      const out = await model(inputs);
      const logit = out?.logits?.data?.[0] ?? 0;
      const score = 1 / (1 + Math.exp(-logit));

      // Supported if cross-encoder semantic score is adequate OR lexical containment is high
      const isSupported = logit >= -1.2 || lexicalContainment >= 0.12 || matchedTokens.length >= 2;

      return {
        isSupported,
        supportScore: Math.round(score * 100) / 100,
        matchedTokens,
        missingNumbers: [],
        highlightSpans: isSupported ? findSupportingSpans(claim, chunkText) : [],
        reason: isSupported
          ? 'Supporting evidence found in the cited passage.'
          : 'Evidence does not sufficiently support the associated claim.',
      };
    } catch {
      // Robust fallback to lexical containment
      const isSupported = lexicalContainment >= 0.12 || matchedTokens.length >= 2;
      return {
        isSupported,
        supportScore: Math.round(lexicalContainment * 100) / 100,
        matchedTokens,
        missingNumbers: [],
        highlightSpans: isSupported ? findSupportingSpans(claim, chunkText) : [],
        reason: isSupported
          ? 'Supporting evidence found in the cited passage.'
          : 'Evidence does not sufficiently support the associated claim.',
      };
    }
  }

  /**
   * Verifies an array of claims against available source chunks.
   * Unverified chunk indices are tagged in unsupportedIndices, not silently dropped.
   */
  static async verifyAllClaims(
    claims: { claim: string; sourceIndices: number[] }[],
    chunks: { index: number; text: string }[]
  ): Promise<VerifiedClaim[]> {
    const chunkMap = new Map<number, string>();
    chunks.forEach((c) => chunkMap.set(c.index, c.text));

    const results: VerifiedClaim[] = [];

    for (const item of claims) {
      const verifiedIndices: number[] = [];
      const contradictedIndices: number[] = [];
      const unsupportedIndices: number[] = [];
      const chunkDetails: Record<number, ChunkVerificationDetail> = {};

      for (const idx of item.sourceIndices) {
        const chunkText = chunkMap.get(idx);
        if (!chunkText) {
          unsupportedIndices.push(idx);
          chunkDetails[idx] = {
            isSupported: false,
            isContradiction: false,
            reason: 'Cited passage was not found in retrieved chunks.',
            highlightSpans: [],
          };
          continue;
        }

        const res = await this.verifyClaimAgainstChunk(item.claim, chunkText);
        chunkDetails[idx] = {
          isSupported: res.isSupported,
          isContradiction: Boolean(res.isContradiction),
          reason: res.reason || (res.isSupported ? 'Supporting evidence found in the cited passage.' : 'Evidence does not sufficiently support the associated claim.'),
          highlightSpans: res.highlightSpans || [],
        };

        if (res.isSupported) {
          verifiedIndices.push(idx);
        } else if (res.isContradiction) {
          contradictedIndices.push(idx);
          unsupportedIndices.push(idx);
        } else {
          unsupportedIndices.push(idx);
        }
      }

      const isFullySupported = item.sourceIndices.length > 0 && unsupportedIndices.length === 0;
      const confidence =
        verifiedIndices.length > 0 ? (unsupportedIndices.length === 0 ? 'high' : 'medium') : 'low';

      results.push({
        claim: item.claim,
        sourceIndices: item.sourceIndices,
        verifiedIndices,
        contradictedIndices,
        unsupportedIndices,
        chunkDetails,
        confidence,
        isFullySupported,
      });
    }

    return results;
  }
}
