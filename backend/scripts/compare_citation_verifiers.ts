import { AutoTokenizer, AutoModelForSequenceClassification } from '@xenova/transformers';
import { tuningTestCases, heldOutTestCases, LabeledTestCase } from '../eval/eval_citation_verifier.js';

interface ModelMetrics {
  total: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
}

function computeMetrics(cases: LabeledTestCase[], predictions: boolean[]): ModelMetrics {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < cases.length; i++) {
    const actual = cases[i].expectedSupported;
    const pred = predictions[i];
    if (pred && actual) tp++;
    else if (pred && !actual) fp++;
    else if (!pred && !actual) tn++;
    else fn++;
  }
  const total = cases.length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const accuracy = (tp + tn) / total;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    total,
    tp,
    fp,
    tn,
    fn,
    accuracy: Math.round(accuracy * 1000) / 10,
    precision: Math.round(precision * 1000) / 10,
    recall: Math.round(recall * 1000) / 10,
    f1: Math.round(f1 * 1000) / 1000,
  };
}

async function runBenchmark() {
  console.log('======================================================');
  console.log('  BENCHMARK: MS-MARCO vs DEBERTA-V3-NLI CITATION VERIFIER');
  console.log('  Total Test Cases: 40 (20 Tuning, 20 Held-Out)');
  console.log('======================================================\n');

  // 1. MS-MARCO MiniLM L6 v2
  console.log('[1/2] Loading MS-MARCO cross-encoder...');
  const msModelName = 'Xenova/ms-marco-MiniLM-L-6-v2';
  const msTokenizer = await AutoTokenizer.from_pretrained(msModelName);
  const msModel = await AutoModelForSequenceClassification.from_pretrained(msModelName);

  const testMSMarco = async (testCase: LabeledTestCase): Promise<boolean> => {
    // Number check
    const claimNumbers = (testCase.claim.match(/\b\d+(?:\.\d+)?%?\b/g) || []).map((n) => n.replace('%', ''));
    if (claimNumbers.length > 0) {
      const chunkText = testCase.chunk;
      const allNumbersFound = claimNumbers.every((num) => chunkText.includes(num));
      if (!allNumbersFound) return false;
    }

    const inputs = await msTokenizer(testCase.claim, { text_pair: testCase.chunk });
    const outputs = await msModel(inputs);
    const logit = outputs.logits.data[0];
    return logit >= -1.0;
  };

  // 2. DeBERTa v3 Small NLI
  console.log('[2/2] Loading DeBERTa v3 Small NLI...');
  const nliModelName = 'Xenova/nli-deberta-v3-small';
  const nliTokenizer = await AutoTokenizer.from_pretrained(nliModelName);
  const nliModel = await AutoModelForSequenceClassification.from_pretrained(nliModelName);

  const testDebertaNLI = async (testCase: LabeledTestCase): Promise<boolean> => {
    // Number check
    const claimNumbers = (testCase.claim.match(/\b\d+(?:\.\d+)?%?\b/g) || []).map((n) => n.replace('%', ''));
    if (claimNumbers.length > 0) {
      const chunkText = testCase.chunk;
      const allNumbersFound = claimNumbers.every((num) => chunkText.includes(num));
      if (!allNumbersFound) return false;
    }

    // Premise = chunk, Hypothesis = claim
    const inputs = await nliTokenizer(testCase.chunk, { text_pair: testCase.claim });
    const outputs = await nliModel(inputs);
    // id2label: { '0': 'contradiction', '1': 'entailment', '2': 'neutral' }
    const logits = outputs.logits.data;
    const entailmentScore = logits[1];
    const contradictionScore = logits[0];
    const neutralScore = logits[2];

    // DeBERTa predicts supported if entailment > contradiction and entailment > neutral - 0.5
    return entailmentScore > contradictionScore && (entailmentScore > neutralScore || logits[1] > 0.0);
  };

  const allCases = [...tuningTestCases, ...heldOutTestCases];

  console.log('\nRunning MS-MARCO evaluations...');
  const msTuningPreds: boolean[] = [];
  for (const c of tuningTestCases) msTuningPreds.push(await testMSMarco(c));
  const msHeldOutPreds: boolean[] = [];
  for (const c of heldOutTestCases) msHeldOutPreds.push(await testMSMarco(c));

  console.log('Running DeBERTa NLI evaluations...');
  const nliTuningPreds: boolean[] = [];
  for (const c of tuningTestCases) nliTuningPreds.push(await testDebertaNLI(c));
  const nliHeldOutPreds: boolean[] = [];
  for (const c of heldOutTestCases) nliHeldOutPreds.push(await testDebertaNLI(c));

  const msTuning = computeMetrics(tuningTestCases, msTuningPreds);
  const msHeldOut = computeMetrics(heldOutTestCases, msHeldOutPreds);
  const msOverall = computeMetrics(allCases, [...msTuningPreds, ...msHeldOutPreds]);

  const nliTuning = computeMetrics(tuningTestCases, nliTuningPreds);
  const nliHeldOut = computeMetrics(heldOutTestCases, nliHeldOutPreds);
  const nliOverall = computeMetrics(allCases, [...nliTuningPreds, ...nliHeldOutPreds]);

  console.log('\n======================================================');
  console.log('  FINAL VERIFIER COMPARISON RESULTS');
  console.log('======================================================');
  console.log('\n1. MS-MARCO MiniLM Cross-Encoder:');
  console.log('   Tuning:   Accuracy', msTuning.accuracy + '%, Precision', msTuning.precision + '%, Recall', msTuning.recall + '%, F1', msTuning.f1);
  console.log('   Held-Out: Accuracy', msHeldOut.accuracy + '%, Precision', msHeldOut.precision + '%, Recall', msHeldOut.recall + '%, F1', msHeldOut.f1);
  console.log('   Overall:  Accuracy', msOverall.accuracy + '%, Precision', msOverall.precision + '%, Recall', msOverall.recall + '%, F1', msOverall.f1);

  console.log('\n2. DeBERTa-v3 Small NLI Cross-Encoder:');
  console.log('   Tuning:   Accuracy', nliTuning.accuracy + '%, Precision', nliTuning.precision + '%, Recall', nliTuning.recall + '%, F1', nliTuning.f1);
  console.log('   Held-Out: Accuracy', nliHeldOut.accuracy + '%, Precision', nliHeldOut.precision + '%, Recall', nliHeldOut.recall + '%, F1', nliHeldOut.f1);
  console.log('   Overall:  Accuracy', nliOverall.accuracy + '%, Precision', nliOverall.precision + '%, Recall', nliOverall.recall + '%, F1', nliOverall.f1);
  console.log('======================================================\n');
}

runBenchmark().catch(console.error);

