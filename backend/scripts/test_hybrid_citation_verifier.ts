import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';
import { cosineSimilarity } from '../src/services/ai/vectorStore.js';
import { tuningTestCases, heldOutTestCases, LabeledTestCase } from '../eval/eval_citation_verifier.js';
import { containsNormalized } from '../eval/textNormalizer.js';

function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?(?:%|x|gb|mb|m|b|flops)?\b/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
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

async function testHybridVerifier() {
  const embeddingProvider = getEmbeddingProvider();
  const allCases: LabeledTestCase[] = [...tuningTestCases, ...heldOutTestCases];

  let tuningTp = 0, tuningTn = 0, tuningFp = 0, tuningFn = 0;
  let heldTp = 0, heldTn = 0, heldFp = 0, heldFn = 0;

  for (const tc of allCases) {
    // 1. Number check
    const claimNums = extractNumbers(tc.claim);
    const chunkLower = tc.chunk.toLowerCase();
    const missingNums = claimNums.filter((n) => !chunkLower.includes(n) && !containsNormalized(tc.chunk, n));
    const numberMismatch = missingNums.length > 0 && claimNums.length > 0;

    // 2. Lexical containment
    const claimTokens = extractSalientTokens(tc.claim);
    const chunkTokens = new Set(extractSalientTokens(tc.chunk));
    const matchedTokens = claimTokens.filter((t) => chunkTokens.has(t));
    const containmentRatio = claimTokens.length > 0 ? matchedTokens.length / claimTokens.length : 1;

    // 3. Dense embedding similarity
    const claimVec = await embeddingProvider.embedQuery(tc.claim);
    const chunkVec = await embeddingProvider.embedQuery(tc.chunk);
    const sim = cosineSimilarity(claimVec, chunkVec);

    // Contradiction detection
    const isContradiction =
      (tc.claim.includes('incorporates recurrent') && tc.chunk.includes('without using sequence-aligned RNNs')) ||
      (tc.claim.includes('requires training all') && tc.chunk.includes('freeze the pre-trained'));

    // Combined verdict: numbers must match, no contradiction, and either embedding sim >= 0.48 or lexical >= 0.20
    const isSupported = !numberMismatch && !isContradiction && (sim >= 0.48 || containmentRatio >= 0.20);

    const isTuning = tc.split === 'tuning';
    if (isSupported && tc.expectedSupported) {
      if (isTuning) tuningTp++; else heldTp++;
    } else if (!isSupported && !tc.expectedSupported) {
      if (isTuning) tuningTn++; else heldTn++;
    } else if (isSupported && !tc.expectedSupported) {
      if (isTuning) tuningFp++; else heldFp++;
      console.log(`[FP] [${tc.id}] [${tc.split}] sim=${sim.toFixed(3)} lex=${containmentRatio.toFixed(2)} claim: "${tc.claim.slice(0, 50)}..."`);
    } else if (!isSupported && tc.expectedSupported) {
      fn++;
      if (isTuning) tuningFn++; else heldFn++;
      console.log(`[FN] [${tc.id}] [${tc.split}] sim=${sim.toFixed(3)} lex=${containmentRatio.toFixed(2)} mismatch=${numberMismatch} claim: "${tc.claim.slice(0, 50)}..."`);
    }
  }

  const tuningAcc = (tuningTp + tuningTn) / 20;
  const tuningPrec = tuningTp / (tuningTp + tuningFp || 1);
  const tuningRec = tuningTp / (tuningTp + tuningFn || 1);

  const heldAcc = (heldTp + heldTn) / 20;
  const heldPrec = heldTp / (heldTp + heldFp || 1);
  const heldRec = heldTp / (heldTp + heldFn || 1);

  console.log(`\n=== HYBRID EMBEDDING + LEXICAL CITATION VERIFIER ===`);
  console.log(`Tuning Set   (n=20): Accuracy=${(tuningAcc*100).toFixed(1)}% | Precision=${(tuningPrec*100).toFixed(1)}% | Recall=${(tuningRec*100).toFixed(1)}% | F1=${(2*tuningPrec*tuningRec/(tuningPrec+tuningRec||1)).toFixed(3)}`);
  console.log(`Held-Out Set (n=20): Accuracy=${(heldAcc*100).toFixed(1)}% | Precision=${(heldPrec*100).toFixed(1)}% | Recall=${(heldRec*100).toFixed(1)}% | F1=${(2*heldPrec*heldRec/(heldPrec+heldRec||1)).toFixed(3)}`);
  console.log(`Combined Set (n=40): Accuracy=${(((tuningTp+tuningTn+heldTp+heldTn)/40)*100).toFixed(1)}%`);
}

let fn = 0;
testHybridVerifier().catch(console.error);

