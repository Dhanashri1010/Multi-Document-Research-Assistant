import { AutoTokenizer, AutoModelForSequenceClassification } from '@xenova/transformers';
import { tuningTestCases, heldOutTestCases, LabeledTestCase } from '../eval/eval_citation_verifier.js';

function extractNumbers(text: string): string[] {
  const matches = text.match(/\b\d+(?:\.\d+)?(?:%|x|gb|mb|m|b|flops)?\b/gi) || [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

async function runCrossEncoderVerifier() {
  console.log('Loading cross-encoder for Citation Verification...');
  const modelId = 'Xenova/ms-marco-MiniLM-L-6-v2';
  const tokenizer = await AutoTokenizer.from_pretrained(modelId);
  const model = await AutoModelForSequenceClassification.from_pretrained(modelId);

  const allCases: LabeledTestCase[] = [...tuningTestCases, ...heldOutTestCases];

  for (const thresholdLogit of [-2.0, -1.0, 0.0, 1.0, 2.0]) {
    let tuningTp = 0, tuningTn = 0, tuningFp = 0, tuningFn = 0;
    let heldTp = 0, heldTn = 0, heldFp = 0, heldFn = 0;

    for (const tc of allCases) {
      const inputs = await tokenizer(tc.claim, { text_pair: tc.chunk.slice(0, 512) });
      const out = await model(inputs);
      const logit = out.logits.data[0];

      // Number check
      const claimNums = extractNumbers(tc.claim);
      const chunkLower = tc.chunk.toLowerCase();
      const missingNums = claimNums.filter((n) => !chunkLower.includes(n));
      const numberMismatch = missingNums.length > 0 && claimNums.length > 0;

      const isSupported = logit >= thresholdLogit && !numberMismatch;
      const isTuning = tc.split === 'tuning';

      if (isSupported && tc.expectedSupported) {
        if (isTuning) tuningTp++; else heldTp++;
      } else if (!isSupported && !tc.expectedSupported) {
        if (isTuning) tuningTn++; else heldTn++;
      } else if (isSupported && !tc.expectedSupported) {
        if (isTuning) tuningFp++; else heldFp++;
      } else if (!isSupported && tc.expectedSupported) {
        if (isTuning) tuningFn++; else heldFn++;
      }
    }

    const tuningAcc = (tuningTp + tuningTn) / 20;
    const tuningPrec = tuningTp / (tuningTp + tuningFp || 1);
    const tuningRec = tuningTp / (tuningTp + tuningFn || 1);

    const heldAcc = (heldTp + heldTn) / 20;
    const heldPrec = heldTp / (heldTp + heldFp || 1);
    const heldRec = heldTp / (heldTp + heldFn || 1);

    console.log(`\nLogit Threshold: ${thresholdLogit}`);
    console.log(`  Tuning Set   : Acc=${(tuningAcc*100).toFixed(1)}% | Prec=${(tuningPrec*100).toFixed(1)}% | Rec=${(tuningRec*100).toFixed(1)}%`);
    console.log(`  Held-Out Set : Acc=${(heldAcc*100).toFixed(1)}% | Prec=${(heldPrec*100).toFixed(1)}% | Rec=${(heldRec*100).toFixed(1)}%`);
    console.log(`  Combined Acc : ${(((tuningTp+tuningTn+heldTp+heldTn)/40)*100).toFixed(1)}%`);
  }
}

runCrossEncoderVerifier().catch(console.error);

