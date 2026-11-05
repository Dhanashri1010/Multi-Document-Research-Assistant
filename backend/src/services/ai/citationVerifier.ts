/**
 * Citation Verifier Service
 * Validates that each cited document chunk actually supports the claim made in the generated answer.
 * Checks lexical overlap, key numeric/formula preservation, and flags unsupported claims.
 */

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
  const matches = text.match(/\b\d+(?:\.\d+)?(?:%|x|gb|mb|m|b|flops)?\b/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

export interface VerificationResult {
  isSupported: boolean;
  supportScore: number;
  matchedTokens: string[];
  missingNumbers: string[];
  reason?: string;
}

export interface VerifiedClaim {
  claim: string;
  sourceIndices: number[];
  verifiedIndices: number[];
  unsupportedIndices: number[];
  confidence: 'high' | 'medium' | 'low';
  isFullySupported: boolean;
}

export class CitationVerifier {
  /**
   * Verifies if a specific chunk supports a single claim sentence.
   */
  static verifyClaimAgainstChunk(claim: string, chunkText: string): VerificationResult {
    if (!claim || !chunkText) {
      return { isSupported: false, supportScore: 0, matchedTokens: [], missingNumbers: [] };
    }

    const claimTokens = extractSalientTokens(claim);
    if (claimTokens.length === 0) {
      return { isSupported: true, supportScore: 1, matchedTokens: [], missingNumbers: [] };
    }

    const chunkTokenSet = new Set(extractSalientTokens(chunkText));
    const matchedTokens = claimTokens.filter((t) => chunkTokenSet.has(t));

    // Token containment ratio
    const containmentRatio = matchedTokens.length / claimTokens.length;

    // Numerical & entity check: any concrete numbers/ratios in the claim must exist in the chunk
    const claimNumbers = extractNumbersAndCodes(claim);
    const chunkLower = chunkText.toLowerCase();
    const missingNumbers = claimNumbers.filter((num) => !chunkLower.includes(num));

    // A claim is supported if:
    // 1. At least 22% of salient tokens overlap (standard semantic containment)
    // 2. All specific numbers (e.g. 28.4, 350GB, 175B) in the claim are present in the chunk
    const numberMismatch = missingNumbers.length > 0 && claimNumbers.length > 0;
    const isSupported = containmentRatio >= 0.22 && !numberMismatch;

    let reason: string | undefined;
    if (numberMismatch) {
      reason = `Missing expected numbers/metrics: ${missingNumbers.join(', ')}`;
    } else if (containmentRatio < 0.22) {
      reason = `Low lexical containment (${Math.round(containmentRatio * 100)}% < 22%)`;
    }

    return {
      isSupported,
      supportScore: Math.round(containmentRatio * 100) / 100,
      matchedTokens,
      missingNumbers,
      reason,
    };
  }

  /**
   * Verifies an array of claims against available source chunks.
   * Drops or flags unverified chunk indices.
   */
  static verifyAllClaims(
    claims: { claim: string; sourceIndices: number[] }[],
    chunks: { index: number; text: string }[]
  ): VerifiedClaim[] {
    const chunkMap = new Map<number, string>();
    chunks.forEach((c) => chunkMap.set(c.index, c.text));

    return claims.map((item) => {
      const verifiedIndices: number[] = [];
      const unsupportedIndices: number[] = [];

      for (const idx of item.sourceIndices) {
        const chunkText = chunkMap.get(idx);
        if (!chunkText) {
          unsupportedIndices.push(idx);
          continue;
        }

        const res = this.verifyClaimAgainstChunk(item.claim, chunkText);
        if (res.isSupported) {
          verifiedIndices.push(idx);
        } else {
          unsupportedIndices.push(idx);
        }
      }

      const isFullySupported = item.sourceIndices.length > 0 && unsupportedIndices.length === 0;
      const confidence =
        verifiedIndices.length > 0 ? (unsupportedIndices.length === 0 ? 'high' : 'medium') : 'low';

      return {
        claim: item.claim,
        sourceIndices: item.sourceIndices,
        verifiedIndices,
        unsupportedIndices,
        confidence,
        isFullySupported,
      };
    });
  }
}
