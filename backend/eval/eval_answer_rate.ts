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
import { containsNormalized } from './textNormalizer.js';

export interface GroundedAnswerResult {
  id: string;
  category: string;
  split: 'tuning' | 'seen-held-out' | 'blind';
  query: string;
  expectedAnswerSpan?: string;
  hasInsufficientEvidence: boolean;
  receivedRealAnswer: boolean;
  wronglyRefused: boolean;
  isCorrect: boolean;
  answer: string;
  citationsCount: number;
  citations: { docName: string; pageNumber: number; text: string }[];
}

export interface AnswerRateMetrics {
  total: number;
  realAnswers: number;
  wronglyRefused: number;
  correctAnswers: number;
  answerRate: number;
  refusalRate: number;
  correctnessRateOnAnswered: number;
  endToEndCorrectRate: number;
}

export interface SpotCheckRecord {
  id: string;
  split: string;
  category: string;
  query: string;
  answerPreview: string;
  expectedAnswer: string;
  isCorrect: boolean;
  citations: string[];
  claimVerification: {
    totalClaims: number;
    supportedClaims: number;
    faithfulnessScore: number;
  };
  verdict: 'FAITHFUL' | 'PARTIALLY_SUPPORTED' | 'UNFAITHFUL';
}

export interface MultiRunStats {
  runs: { runIndex: number; answerRate: number; correctnessRate: number }[];
  meanAnswerRate: number;
  spreadAnswerRate: number;
  meanCorrectnessRate: number;
}

export async function evaluateAnswerRate(numRuns: number = 1): Promise<{
  tuningMetrics: AnswerRateMetrics;
  seenHeldOutMetrics: AnswerRateMetrics;
  blindMetrics: AnswerRateMetrics;
  overallMetrics: AnswerRateMetrics;
  multiRunStats?: MultiRunStats;
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
  console.log(`   LLM: ${config.llmProvider} (${config.llmModel}) | Temperature: 0.0`);
  console.log(`   Splits: Tuning, Seen Held-Out, and Blind (q61-q75)`);
  console.log(`   Target-Doc Filter: Active (Mirrors Real UI)`);
  console.log('======================================================\n');

  const runHistory: { runIndex: number; answerRate: number; correctnessRate: number }[] = [];
  let primaryResults: GroundedAnswerResult[] = [];

  for (let r = 0; r < numRuns; r++) {
    if (numRuns > 1) {
      console.log(`\n--- STARTING EVALUATION RUN ${r + 1} OF ${numRuns} (Temperature: 0.0) ---`);
    }

    const currentRunResults: GroundedAnswerResult[] = [];

    for (const q of groundedQueries) {
      const split = q.split || 'tuning';

      // Restrict retrieval to document(s) targeted by this question (mirrors real UI)
      const targetDocIds: string[] = [];
      if (q.targetDocs && q.targetDocs.length > 0) {
        for (const targetName of q.targetDocs) {
          for (const [id, origName] of docMap.entries()) {
            if (
              origName.toLowerCase().includes(targetName.toLowerCase()) ||
              targetName.toLowerCase().includes(origName.toLowerCase())
            ) {
              targetDocIds.push(id);
            }
          }
        }
      }
      const queryDocIds = targetDocIds.length > 0 ? targetDocIds : docIds;

      let res: any;
      try {
        res = await RAGService.ask({
          question: q.query,
          documentIds: queryDocIds,
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

      // Correctness Check: does the generated answer contain the expected span or key phrases?
      let isCorrect = false;
      if (receivedRealAnswer && q.expectedAnswerSpan) {
        const hasSpan = containsNormalized(res.answer, q.expectedAnswerSpan);
        const hasKeyPhrase = Array.isArray(q.keyPhrases) && q.keyPhrases.some((kp: string) => containsNormalized(res.answer, kp));
        isCorrect = hasSpan || hasKeyPhrase;
      }

      currentRunResults.push({
        id: q.id,
        category: q.category,
        split,
        query: q.query,
        expectedAnswerSpan: q.expectedAnswerSpan,
        hasInsufficientEvidence: Boolean(res.hasInsufficientEvidence),
        receivedRealAnswer,
        wronglyRefused,
        isCorrect,
        answer: res.answer,
        citationsCount: res.citations?.length || 0,
        citations: (res.citations || []).map((c: any) => ({
          docName: c.documentName || docMap.get(c.documentId?.toString()) || 'Doc',
          pageNumber: c.pageNumber || 1,
          text: c.excerpt || '',
        })),
      });

      const statusIcon = receivedRealAnswer ? (isCorrect ? '✓ ANSWERED (CORRECT)' : '✓ ANSWERED (PARTIAL)') : '✗ REFUSED';
      console.log(
        `  [${q.id}] [${split.padEnd(13)}] [${q.category.padEnd(11)}] ${statusIcon.padEnd(20)} | "${q.query.slice(0, 40)}..."`
      );

      // Polite delay between queries to respect API rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const answered = currentRunResults.filter((item) => item.receivedRealAnswer).length;
    const correct = currentRunResults.filter((item) => item.isCorrect).length;
    const runAnswerRate = Math.round((answered / currentRunResults.length) * 1000) / 10;
    const runCorrectRate = Math.round((correct / answered) * 1000) / 10;

    runHistory.push({
      runIndex: r + 1,
      answerRate: runAnswerRate,
      correctnessRate: runCorrectRate,
    });

    if (r === 0) {
      primaryResults = currentRunResults;
    }
  }

  const computeRate = (subset: GroundedAnswerResult[]): AnswerRateMetrics => {
    const total = subset.length;
    const realAnswers = subset.filter((r) => r.receivedRealAnswer).length;
    const wronglyRefused = subset.filter((r) => r.wronglyRefused).length;
    const correctAnswers = subset.filter((r) => r.isCorrect).length;
    return {
      total,
      realAnswers,
      wronglyRefused,
      correctAnswers,
      answerRate: total > 0 ? Math.round((realAnswers / total) * 1000) / 10 : 0,
      refusalRate: total > 0 ? Math.round((wronglyRefused / total) * 1000) / 10 : 0,
      correctnessRateOnAnswered: realAnswers > 0 ? Math.round((correctAnswers / realAnswers) * 1000) / 10 : 0,
      endToEndCorrectRate: total > 0 ? Math.round((correctAnswers / total) * 1000) / 10 : 0,
    };
  };

  const tuningResults = primaryResults.filter((r) => r.split === 'tuning');
  const seenHeldOutResults = primaryResults.filter((r) => r.split === 'seen-held-out');
  const blindResults = primaryResults.filter((r) => r.split === 'blind');

  const tuningMetrics = computeRate(tuningResults);
  const seenHeldOutMetrics = computeRate(seenHeldOutResults);
  const blindMetrics = computeRate(blindResults);
  const overallMetrics = computeRate(primaryResults);

  // Compute multi-run spread
  const answerRates = runHistory.map((h) => h.answerRate);
  const meanAnswerRate = Math.round((answerRates.reduce((a, b) => a + b, 0) / answerRates.length) * 10) / 10;
  const spreadAnswerRate = Math.round((Math.max(...answerRates) - Math.min(...answerRates)) * 10) / 10;
  const correctnessRates = runHistory.map((h) => h.correctnessRate);
  const meanCorrectnessRate = Math.round((correctnessRates.reduce((a, b) => a + b, 0) / correctnessRates.length) * 10) / 10;

  const multiRunStats: MultiRunStats = {
    runs: runHistory,
    meanAnswerRate,
    spreadAnswerRate,
    meanCorrectnessRate,
  };

  // Spot-check faithfulness on 10 diverse answers (4 tuning, 3 seen-held-out, 3 blind)
  const spotCheckIds = [
    // Tuning (4)
    'q01', // single-doc Transformer BLEU 28.4
    'q08', // single-doc LoRA init A/B
    'q13', // table FLOPs ConvS2S vs Transformer
    'q21', // equation ResNet residual mapping
    // Seen Held-Out (3)
    'q15', // table BERT-Large vs Base params
    'q17', // table GPT-3 175B specs
    'q22', // equation Adam v_t update
    // Blind (3)
    'q62', // table Logistic Regression 61.2%
    'q64', // equation Forward accumulation
    'q66', // equation Linear projection shortcut
  ];

  const spotChecks: SpotCheckRecord[] = [];

  for (const id of spotCheckIds) {
    const item = primaryResults.find((r) => r.id === id);
    if (!item) continue;

    // Split answer into sentences / claims
    const sentences = item.answer
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    const contextText = item.citations.map((c) => c.text).join(' ');

    let supportedCount = 0;
    if (contextText.trim().length > 0) {
      for (const sent of sentences) {
        const v = await CitationVerifier.verifyClaimAgainstChunk(sent, contextText);
        if (v.isSupported) supportedCount++;
      }
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
      isCorrect: item.isCorrect,
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
    seenHeldOutMetrics,
    blindMetrics,
    overallMetrics,
    multiRunStats,
    spotChecks,
    allResults: primaryResults,
  };
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('eval_answer_rate.ts');
if (isDirectRun) {
  evaluateAnswerRate(3)
    .then((res) => {
      console.log('\n======================================================');
      console.log('   FULL PIPELINE 3-RUN STATS (TEMPERATURE 0.0)');
      console.log('======================================================');
      console.log('Runs:', res.multiRunStats?.runs);
      console.log(`Mean Answer Rate: ${res.multiRunStats?.meanAnswerRate}% (Spread: ±${res.multiRunStats?.spreadAnswerRate}%)`);
      console.log(`Mean Answer Correctness: ${res.multiRunStats?.meanCorrectnessRate}%`);
      console.log('======================================================\n');
    })
    .catch(console.error);
}
