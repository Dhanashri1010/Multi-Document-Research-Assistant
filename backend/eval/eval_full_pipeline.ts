import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { RAGService } from '../src/services/ai/ragService.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';

interface QueryResult {
  id: string;
  split: 'tuning' | 'held-out';
  category: string;
  isTrap: boolean;
  query: string;
  hasInsufficientEvidence: boolean;
  answerPreview: string;
  citationsCount: number;
  refusalSuccess: boolean;
}

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/multi_doc_research');
  const docs = await DocumentModel.find({ status: 'ready' }).lean();
  const docIds = docs.map((d) => d._id.toString());

  const datasetPath = fs.existsSync(path.resolve(process.cwd(), 'eval', 'dataset.json'))
    ? path.resolve(process.cwd(), 'eval', 'dataset.json')
    : path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const offTopicQueries = dataset.filter((q: any) => q.isOffTopic);

  console.log('======================================================');
  console.log(`  EVALUATING FULL PIPELINE REFUSAL ACCURACY (N=${offTopicQueries.length})`);
  console.log(`  Pre-LLM Cosine Gate Threshold: ${config.preLlmCosineThreshold}`);
  console.log(`  LLM Provider: ${config.llmProvider} (${config.llmModel})`);
  console.log('======================================================\n');

  const results: QueryResult[] = [];

  for (const q of offTopicQueries) {
    const isTrap = Boolean(q.isTrap);
    const split = q.split || 'tuning';

    const res = await RAGService.ask({
      question: q.query,
      documentIds: docIds,
    });

    const refusalSuccess = res.hasInsufficientEvidence === true;

    results.push({
      id: q.id,
      split,
      category: isTrap ? 'in-domain-trap' : 'out-of-domain',
      isTrap,
      query: q.query,
      hasInsufficientEvidence: res.hasInsufficientEvidence,
      answerPreview: res.answer.replace(/\n+/g, ' ').slice(0, 110),
      citationsCount: res.citations.length,
      refusalSuccess,
    });

    const statusIcon = refusalSuccess ? '✓ REFUSED' : '✗ FAILED (False Positive)';
    const tag = `[${split.padEnd(8)}] [${isTrap ? 'TRAP' : 'DIST'}]`;
    console.log(`  ${q.id} ${tag} ${statusIcon} | "${q.query.slice(0, 65)}..."`);
  }

  // Aggregate stats
  const tuningDist = results.filter((r) => r.split === 'tuning' && !r.isTrap);
  const tuningTrap = results.filter((r) => r.split === 'tuning' && r.isTrap);
  const heldDist = results.filter((r) => (r.split === 'held-out' || r.split === 'seen-held-out') && !r.isTrap);
  const heldTrap = results.filter((r) => (r.split === 'held-out' || r.split === 'seen-held-out') && r.isTrap);

  const calcAcc = (subset: QueryResult[]) => {
    if (subset.length === 0) return 0;
    const passed = subset.filter((s) => s.refusalSuccess).length;
    return (passed / subset.length) * 100;
  };

  console.log('\n======================================================');
  console.log('       FULL PIPELINE REFUSAL EVALUATION METRICS       ');
  console.log('======================================================');
  console.log(`TUNING SET (n=${tuningDist.length + tuningTrap.length}):`);
  console.log(`  - Out-of-Domain Distractors (n=${tuningDist.length}): ${calcAcc(tuningDist).toFixed(1)}% (${tuningDist.filter(s=>s.refusalSuccess).length}/${tuningDist.length} refused)`);
  console.log(`  - Deceptive In-Domain Traps (n=${tuningTrap.length}): ${calcAcc(tuningTrap).toFixed(1)}% (${tuningTrap.filter(s=>s.refusalSuccess).length}/${tuningTrap.length} refused)`);
  console.log(`  - Combined Tuning Refusal:             ${calcAcc([...tuningDist, ...tuningTrap]).toFixed(1)}%`);

  console.log(`\nHELD-OUT SET (n=${heldDist.length + heldTrap.length}):`);
  console.log(`  - Out-of-Domain Distractors (n=${heldDist.length}): ${calcAcc(heldDist).toFixed(1)}% (${heldDist.filter(s=>s.refusalSuccess).length}/${heldDist.length} refused)`);
  console.log(`  - Deceptive In-Domain Traps (n=${heldTrap.length}): ${calcAcc(heldTrap).toFixed(1)}% (${heldTrap.filter(s=>s.refusalSuccess).length}/${heldTrap.length} refused)`);
  console.log(`  - Combined Held-Out Refusal:           ${calcAcc([...heldDist, ...heldTrap]).toFixed(1)}%`);

  console.log(`\nOVERALL REFUSAL ACCURACY (n=${results.length}):`);
  console.log(`  - Total Out-of-Domain (n=${tuningDist.length + heldDist.length}):   ${calcAcc([...tuningDist, ...heldDist]).toFixed(1)}%`);
  console.log(`  - Total In-Domain Traps (n=${tuningTrap.length + heldTrap.length}): ${calcAcc([...tuningTrap, ...heldTrap]).toFixed(1)}%`);
  console.log(`  - ALL OFF-TOPIC COMBINED:           ${calcAcc(results).toFixed(1)}% (${results.filter(s=>s.refusalSuccess).length}/${results.length} refused)`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

main().catch(console.error);

