import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { RAGService } from '../src/services/ai/ragService.js';
import { DocumentModel } from '../src/models/Document.js';
import { CitationVerifier } from '../src/services/ai/citationVerifier.js';
import { config } from '../src/config/env.js';

export interface GroundedAnswerResult {
  id: string;
  category: string;
  split: 'tuning' | 'held-out';
  query: string;
  expectedAnswerSpan?: string;
  hasInsufficientEvidence: boolean;
  receivedRealAnswer: boolean;
  wronglyRefused: boolean;
  answer: string;
  citationsCount: number;
  citations: { docName: string; pageNumber: number; text: string }[];
}

export interface AnswerRateMetrics {
  total: number;
  realAnswers: number;
  wronglyRefused: number;
  answerRate: number;
  refusalRate: number;
}

export interface SpotCheckRecord {
  id: string;
  split: string;
  category: string;
  query: string;
  answerPreview: string;
  expectedAnswer: string;
  citations: string[];
  claimVerification: {
    totalClaims: number;
    supportedClaims: number;
    faithfulnessScore: number;
  };
  verdict: 'FAITHFUL' | 'PARTIALLY_SUPPORTED' | 'UNFAITHFUL';
}

export async function evaluateAnswerRate(): Promise<{
  tuningMetrics: AnswerRateMetrics;
  heldOutMetrics: AnswerRateMetrics;
  overallMetrics: AnswerRateMetrics;
  spotChecks: SpotCheckRecord[];
  allResults: GroundedAnswerResult[];
}> {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const datasetPath = fs.existsSync(path.resolve(process.cwd(), 'eval', 'dataset.json'))
    ? path.resolve(process.cwd(), 'eval', 'dataset.json')
    : path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const groundedQueries = dataset.filter((q: any) => !q.isOffTopic);

  // Get active benchmark docs
  const readyDocs = await DocumentModel.find({ status: 'ready' }).lean();
  const docIds = readyDocs.map((d) => d._id.toString());
  const docMap = new Map(readyDocs.map((d) => [d._id.toString(), d.originalName]));

  console.log('======================================================');
  console.log(`   EVALUATING GROUNDED ANSWER RATE ACROSS ${groundedQueries.length} QUERIES`);
  console.log(`   Active Documents: ${readyDocs.length} | LLM: ${config.llmProvider} (${config.llmModel})`);
  console.log('======================================================\n');

  const allResults: GroundedAnswerResult[] = [];

  for (const q of groundedQueries) {
    const split = q.split || 'tuning';

    let res: any;
    try {
      res = await RAGService.ask({
        question: q.query,
        documentIds: docIds,
      });
    } catch (err: any) {
      console.error(`Error querying ${q.id}:`, err.message);
      res = {
        answer: 'Failed to generate answer',
        citations: [],
        hasInsufficientEvidence: true,
      };
    }

    const wronglyRefused = res.hasInsufficientEvidence === true;
    const receivedRealAnswer = !wronglyRefused && res.answer && res.answer.length > 20;

    allResults.push({
      id: q.id,
      category: q.category,
      split,
      query: q.query,
      expectedAnswerSpan: q.expectedAnswerSpan,
      hasInsufficientEvidence: Boolean(res.hasInsufficientEvidence),
      receivedRealAnswer,
      wronglyRefused,
      answer: res.answer,
      citationsCount: res.citations?.length || 0,
      citations: (res.citations || []).map((c: any) => ({
        docName: c.documentName || docMap.get(c.documentId?.toString()) || 'Doc',
        pageNumber: c.pageNumber || 1,
        text: c.excerpt || '',
      })),
    });

    const statusIcon = receivedRealAnswer ? '✓ ANSWERED' : '✗ REFUSED';
    console.log(`  [${q.id}] [${split.padEnd(8)}] [${q.category.padEnd(11)}] ${statusIcon} | "${q.query.slice(0, 50)}..."`);

    // Polite delay between batch evaluation queries to respect API rate limits
    await new Promise((r) => setTimeout(r, 1500));
  }

  const computeRate = (subset: GroundedAnswerResult[]): AnswerRateMetrics => {
    const total = subset.length;
    const realAnswers = subset.filter((r) => r.receivedRealAnswer).length;
    const wronglyRefused = subset.filter((r) => r.wronglyRefused).length;
    return {
      total,
      realAnswers,
      wronglyRefused,
      answerRate: total > 0 ? Math.round((realAnswers / total) * 1000) / 10 : 0,
      refusalRate: total > 0 ? Math.round((wronglyRefused / total) * 1000) / 10 : 0,
    };
  };

  const tuningResults = allResults.filter((r) => r.split === 'tuning');
  const heldOutResults = allResults.filter((r) => r.split === 'held-out');

  const tuningMetrics = computeRate(tuningResults);
  const heldOutMetrics = computeRate(heldOutResults);
  const overallMetrics = computeRate(allResults);

  // Spot-check faithfulness on 10 diverse answers (5 tuning, 5 held-out)
  const spotCheckIds = [
    // Tuning (5)
    'q01', // single-doc Transformer BLEU 28.4
    'q08', // single-doc LoRA init A/B
    'q13', // table FLOPs ConvS2S vs Transformer
    'q21', // equation ResNet residual mapping
    'q52', // Paper 21 Random Forest 82.6%
    // Held-out (5)
    'q15', // table BERT-Large vs Base params
    'q17', // table GPT-3 175B specs
    'q22', // equation Adam v_t update
    'q26', // paraphrased checkpoint explosion
    'q57', // Paper 21 100% training accuracy models
  ];

  const spotChecks: SpotCheckRecord[] = [];

  for (const id of spotCheckIds) {
    const item = allResults.find((r) => r.id === id);
    if (!item) continue;

    // Split answer into sentences / claims
    const sentences = item.answer
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const contextText = item.citations.map((c) => c.text).join(' ');

    let supportedCount = 0;
    for (const sent of sentences) {
      const v = await CitationVerifier.verifyClaimAgainstChunk(sent, contextText);
      if (v.isSupported) supportedCount++;
    }

    const faithfulnessScore =
      sentences.length > 0 ? Math.round((supportedCount / sentences.length) * 100) : 100;

    let verdict: 'FAITHFUL' | 'PARTIALLY_SUPPORTED' | 'UNFAITHFUL' = 'FAITHFUL';
    if (faithfulnessScore < 50) verdict = 'UNFAITHFUL';
    else if (faithfulnessScore < 85) verdict = 'PARTIALLY_SUPPORTED';

    spotChecks.push({
      id: item.id,
      split: item.split,
      category: item.category,
      query: item.query,
      answerPreview: item.answer.slice(0, 160).replace(/\s+/g, ' ') + '...',
      expectedAnswer: item.expectedAnswerSpan || 'Grounded target fact',
      citations: item.citations.map((c) => `${c.docName} (p.${c.pageNumber})`),
      claimVerification: {
        totalClaims: sentences.length,
        supportedClaims: supportedCount,
        faithfulnessScore,
      },
      verdict,
    });
  }

  await mongoose.disconnect();

  return {
    tuningMetrics,
    heldOutMetrics,
    overallMetrics,
    spotChecks,
    allResults,
  };
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('eval_answer_rate.ts');
if (isDirectRun) {
  evaluateAnswerRate()
    .then(({ tuningMetrics, heldOutMetrics, overallMetrics, spotChecks }) => {
      console.log('\n======================================================');
      console.log('         GROUNDED ANSWER RATE EVALUATION RESULTS      ');
      console.log('======================================================');
      console.log(`TUNING SET (n=${tuningMetrics.total}):`);
      console.log(`  Real Answers Received: ${tuningMetrics.realAnswers} (${tuningMetrics.answerRate}%)`);
      console.log(`  Wrongly Refused:       ${tuningMetrics.wronglyRefused} (${tuningMetrics.refusalRate}%)`);

      console.log(`\nHELD-OUT SET (n=${heldOutMetrics.total}):`);
      console.log(`  Real Answers Received: ${heldOutMetrics.realAnswers} (${heldOutMetrics.answerRate}%)`);
      console.log(`  Wrongly Refused:       ${heldOutMetrics.wronglyRefused} (${heldOutMetrics.refusalRate}%)`);

      console.log(`\nOVERALL ANSWER RATE (n=${overallMetrics.total}):`);
      console.log(`  Real Answers Received: ${overallMetrics.realAnswers} (${overallMetrics.answerRate}%)`);
      console.log(`  Wrongly Refused:       ${overallMetrics.wronglyRefused} (${overallMetrics.refusalRate}%)`);
      console.log('======================================================\n');

      console.log('======================================================');
      console.log('    SPOT-CHECK FAITHFULNESS AUDIT (10 REPRESENTATIVE)  ');
      console.log('======================================================');
      spotChecks.forEach((sc, i) => {
        console.log(`[${i + 1}/10] [${sc.id}] [${sc.split}] [${sc.category}] ${sc.verdict} (${sc.claimVerification.faithfulnessScore}% faithful)`);
        console.log(`  Query:    ${sc.query}`);
        console.log(`  Answer:   ${sc.answerPreview}`);
        console.log(`  Evidence: ${sc.citations.join(', ')}`);
        console.log(`  Claims:   ${sc.claimVerification.supportedClaims}/${sc.claimVerification.totalClaims} verified\n`);
      });
      console.log('======================================================\n');
    })
    .catch(console.error);
}
