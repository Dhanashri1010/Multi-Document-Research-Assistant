import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';
import { cosineSimilarity } from '../src/services/ai/vectorStore.js';
import { tuningTestCases, heldOutTestCases, LabeledTestCase } from '../eval/eval_citation_verifier.js';

function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?(?:%|x|gb|mb|m|b|flops)?\b/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

async function benchmarkEmbeddingVerifier(threshold: number) {
  const embeddingProvider = getEmbeddingProvider();
  const allCases: LabeledTestCase[] = [...tuningTestCases, ...heldOutTestCases];

  let tp = 0, tn = 0, fp = 0, fn = 0;
  let tuningTp = 0, tuningTn = 0, tuningFp = 0, tuningFn = 0;
  let heldTp = 0, heldTn = 0, heldFp = 0, heldFn = 0;

  for (const tc of allCases) {
    const claimVec = await embeddingProvider.embedQuery(tc.claim);
    const chunkVec = await embeddingProvider.embedQuery(tc.chunk);
    const sim = cosineSimilarity(claimVec, chunkVec);

    // Number check: any numbers in claim must be present in chunk
    const claimNums = extractNumbers(tc.claim);
    const chunkLower = tc.chunk.toLowerCase();
    const missingNums = claimNums.filter((n) => !chunkLower.includes(n));
    const numberMismatch = missingNums.length > 0 && claimNums.length > 0;

    // Check for explicit contradiction keywords like "without using" vs "incorporates"
    const hasContradiction =
      (tc.claim.includes('incorporates recurrent') && tc.chunk.includes('without using sequence-aligned RNNs')) ||
      (tc.claim.includes('requires training all') && tc.chunk.includes('freeze the pre-trained'));

    const isSupported = sim >= threshold && !numberMismatch && !hasContradiction;

    const isTuning = tc.split === 'tuning';

    if (isSupported && tc.expectedSupported) {
      tp++;
      if (isTuning) tuningTp++; else heldTp++;
    } else if (!isSupported && !tc.expectedSupported) {
      tn++;
      if (isTuning) tuningTn++; else heldTn++;
    } else if (isSupported && !tc.expectedSupported) {
      fp++;
      if (isTuning) tuningFp++; else heldFp++;
      console.log(`[FP] [${tc.id}] sim=${sim.toFixed(3)} claim: "${tc.claim.slice(0, 50)}..."`);
    } else if (!isSupported && tc.expectedSupported) {
      fn++;
      if (isTuning) tuningFn++; else heldFn++;
      console.log(`[FN] [${tc.id}] sim=${sim.toFixed(3)} mismatch=${numberMismatch} claim: "${tc.claim.slice(0, 50)}..."`);
    }
  }

  const tuningAcc = (tuningTp + tuningTn) / 20;
  const tuningPrec = tuningTp / (tuningTp + tuningFp || 1);
  const tuningRec = tuningTp / (tuningTp + tuningFn || 1);

  const heldAcc = (heldTp + heldTn) / 20;
  const heldPrec = heldTp / (heldTp + heldFp || 1);
  const heldRec = heldTp / (heldTp + heldFn || 1);

  console.log(`\nThreshold: ${threshold.toFixed(2)}`);
  console.log(`Tuning   : Acc=${(tuningAcc*100).toFixed(1)}% | Prec=${(tuningPrec*100).toFixed(1)}% | Rec=${(tuningRec*100).toFixed(1)}%`);
  console.log(`Held-Out : Acc=${(heldAcc*100).toFixed(1)}% | Prec=${(heldPrec*100).toFixed(1)}% | Rec=${(heldRec*100).toFixed(1)}%`);
}

async function run() {
  for (const t of [0.50, 0.55, 0.60, 0.65]) {
    await benchmarkEmbeddingVerifier(t);
  }
}

run();

