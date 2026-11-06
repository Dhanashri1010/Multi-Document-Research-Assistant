import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';
import { VectorStore } from '../src/services/ai/vectorStore.js';
import { IngestionService } from '../src/services/documents/ingestionService.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';
import { containsNormalized } from './textNormalizer.js';

export interface BenchmarkItem {
  id: string;
  category: 'single-doc' | 'multi-doc' | 'table' | 'equation' | 'paraphrased' | 'off-topic';
  split: 'tuning' | 'seen-held-out' | 'blind';
  query: string;
  targetDocs?: string[];
  targetPage?: number;
  targetPages?: number[];
  keyPhrases: string[];
  expectedAnswerSpan?: string;
  isOffTopic?: boolean;
  isTrap?: boolean;
}

export interface DualSplitMetrics {
  totalQueries: number;
  relevantQueries: number;
  offTopicQueries: number;
  trapQueries: number;
  // Strict matching
  strictHitAt1: number;
  strictHitAt3: number;
  strictHitAt5: number;
  strictMrr: number;
  // Normalized matching
  normHitAt1: number;
  normHitAt3: number;
  normHitAt5: number;
  normMrr: number;
  keywordMatchAt3: number;
  offTopicRefusalAccuracy: number;
  trapRefusalAccuracy: number;
}

export interface FailedQueryRecord {
  id: string;
  split: string;
  category: string;
  isTrap?: boolean;
  query: string;
  expectedAnswerSpan?: string;
  failureType: 'MISSED_GROUND_TRUTH' | 'FALSE_POSITIVE_OFF_TOPIC';
  firstMatchRank?: number;
  retrievedChunks: {
    rank: number;
    docName: string;
    pageNumber: number;
    score: number;
    snippet: string;
  }[];
}

export interface EvalMetrics {
  totalQueries: number;
  relevantQueries: number;
  offTopicQueries: number;
  overall: DualSplitMetrics;
  tuning: DualSplitMetrics;
  seenHeldOut: DualSplitMetrics;
  blind: DualSplitMetrics;
  categoryBreakdown: Record<
    string,
    { total: number; strictH1: number; strictH5: number; normH1: number; normH5: number; normMrr: number }
  >;
  failedQueries: FailedQueryRecord[];
}

const BENCHMARK_PAPERS = [
  { sampleFile: 'attention_is_all_you_need.pdf', name: 'Attention Is All You Need', filename: 'eval_attention.pdf' },
  { sampleFile: 'lora_low_rank_adaptation.pdf', name: 'LoRA: Low-Rank Adaptation', filename: 'eval_lora.pdf' },
  { sampleFile: 'bert_pretraining_deep_bidirectional.pdf', name: 'BERT: Pre-training of Deep Bidirectional Transformers', filename: 'eval_bert.pdf' },
  { sampleFile: 'resnet_deep_residual_learning.pdf', name: 'Deep Residual Learning for Image Recognition', filename: 'eval_resnet.pdf' },
  { sampleFile: 'gpt3_language_models_few_shot.pdf', name: 'Language Models are Few-Shot Learners', filename: 'eval_gpt3.pdf' },
  { sampleFile: 'adam_stochastic_optimization.pdf', name: 'Adam: A Method for Stochastic Optimization', filename: 'eval_adam.pdf' },
  { sampleFile: 'Paper_21-Unmasking_AI_Generated_Texts.pdf', name: 'Unmasking AI-Generated Texts Using Linguistic and Stylistic Features', filename: 'eval_paper21_unmasking.pdf' },
];

async function ensureSampleDocuments(): Promise<{ docIds: string[]; docMap: Map<string, string> }> {
  const uploadDir = fs.existsSync(path.resolve(process.cwd(), 'uploads'))
    ? path.resolve(process.cwd(), 'uploads')
    : path.resolve(process.cwd(), 'backend', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const docIds: string[] = [];
  const docMap = new Map<string, string>();

  for (const paper of BENCHMARK_PAPERS) {
    const samplePath = fs.existsSync(path.resolve(process.cwd(), 'samples', paper.sampleFile))
      ? path.resolve(process.cwd(), 'samples', paper.sampleFile)
      : path.resolve(process.cwd(), '..', 'samples', paper.sampleFile);

    if (!fs.existsSync(samplePath)) {
      console.warn(`[Eval] Sample paper not found at: ${samplePath}`);
      continue;
    }

    const destPath = path.resolve(uploadDir, paper.filename);
    const sampleStat = fs.statSync(samplePath);

    let doc = await DocumentModel.findOne({ originalName: paper.name });
    if (!doc) {
      fs.copyFileSync(samplePath, destPath);
      doc = await DocumentModel.create({
        filename: paper.filename,
        originalName: paper.name,
        fileSize: sampleStat.size,
        mimeType: 'application/pdf',
        filePath: destPath,
        status: 'uploaded',
      });
      await IngestionService.processDocument(doc._id);
      doc = await DocumentModel.findById(doc._id);
    } else {
      const destExists = fs.existsSync(destPath);
      const destStat = destExists ? fs.statSync(destPath) : null;
      if (!destExists || destStat?.size !== sampleStat.size || doc.status !== 'ready') {
        fs.copyFileSync(samplePath, destPath);
        doc.fileSize = sampleStat.size;
        doc.status = 'uploaded';
        await doc.save();
        await IngestionService.processDocument(doc._id);
        doc = await DocumentModel.findById(doc._id);
      }
    }

    if (doc) {
      docIds.push(doc._id.toString());
      docMap.set(doc._id.toString(), paper.name);
    }
  }

  return { docIds, docMap };
}

interface SplitAccumulator {
  total: number;
  relevant: number;
  offTopic: number;
  trapTotal: number;
  trapRefused: number;
  // Strict matching
  strictH1: number;
  strictH3: number;
  strictH5: number;
  strictMrrSum: number;
  // Normalized matching
  normH1: number;
  normH3: number;
  normH5: number;
  normMrrSum: number;
  keywordMatches: number;
  successfulRefusals: number;
}

function createAccumulator(): SplitAccumulator {
  return {
    total: 0,
    relevant: 0,
    offTopic: 0,
    trapTotal: 0,
    trapRefused: 0,
    strictH1: 0,
    strictH3: 0,
    strictH5: 0,
    strictMrrSum: 0,
    normH1: 0,
    normH3: 0,
    normH5: 0,
    normMrrSum: 0,
    keywordMatches: 0,
    successfulRefusals: 0,
  };
}

function computeSplitMetrics(acc: SplitAccumulator): DualSplitMetrics {
  const N = acc.relevant;
  return {
    totalQueries: acc.total,
    relevantQueries: acc.relevant,
    offTopicQueries: acc.offTopic,
    trapQueries: acc.trapTotal,
    strictHitAt1: N > 0 ? Math.round((acc.strictH1 / N) * 1000) / 10 : 0,
    strictHitAt3: N > 0 ? Math.round((acc.strictH3 / N) * 1000) / 10 : 0,
    strictHitAt5: N > 0 ? Math.round((acc.strictH5 / N) * 1000) / 10 : 0,
    strictMrr: N > 0 ? Math.round((acc.strictMrrSum / N) * 1000) / 1000 : 0,
    normHitAt1: N > 0 ? Math.round((acc.normH1 / N) * 1000) / 10 : 0,
    normHitAt3: N > 0 ? Math.round((acc.normH3 / N) * 1000) / 10 : 0,
    normHitAt5: N > 0 ? Math.round((acc.normH5 / N) * 1000) / 10 : 0,
    normMrr: N > 0 ? Math.round((acc.normMrrSum / N) * 1000) / 1000 : 0,
    keywordMatchAt3: N > 0 ? Math.round((acc.keywordMatches / N) * 1000) / 10 : 0,
    offTopicRefusalAccuracy: acc.offTopic > 0 ? Math.round((acc.successfulRefusals / acc.offTopic) * 1000) / 10 : 100,
    trapRefusalAccuracy: acc.trapTotal > 0 ? Math.round((acc.trapRefused / acc.trapTotal) * 1000) / 10 : 100,
  };
}

export async function runEvaluation(): Promise<EvalMetrics> {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const datasetPath = fs.existsSync(path.resolve(process.cwd(), 'eval', 'dataset.json'))
    ? path.resolve(process.cwd(), 'eval', 'dataset.json')
    : path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');
  const dataset: BenchmarkItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const { docIds, docMap } = await ensureSampleDocuments();
  const embeddingProvider = getEmbeddingProvider();

  const overallAcc = createAccumulator();
  const tuningAcc = createAccumulator();
  const seenHeldOutAcc = createAccumulator();
  const blindAcc = createAccumulator();

  const categoryStats: Record<
    string,
    { total: number; strictH1: number; strictH5: number; normH1: number; normH5: number; normMrrSum: number }
  > = {};
  const failedQueries: FailedQueryRecord[] = [];

  console.log(`\n======================================================`);
  console.log(`   RUNNING EVALUATION OVER ${dataset.length} BENCHMARK QUERIES`);
  console.log(`   Corpus: 6 Academic Papers (${docIds.length} active documents)`);
  console.log(`   Splits: Tuning, Seen Held-Out, and Blind (q61-q75)`);
  console.log(`======================================================\n`);

  for (const item of dataset) {
    const split = item.split || 'tuning';
    const cat = item.category || 'single-doc';

    let splitAcc = tuningAcc;
    if (split === 'blind') splitAcc = blindAcc;
    else if (split === 'seen-held-out' || (split as any) === 'held-out') splitAcc = seenHeldOutAcc;

    overallAcc.total++;
    splitAcc.total++;

    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, strictH1: 0, strictH5: 0, normH1: 0, normH5: 0, normMrrSum: 0 };
    }
    categoryStats[cat].total++;

    const queryVector = await embeddingProvider.embedQuery(item.query);

    // Off-Topic / Distractor query evaluation
    if (item.isOffTopic) {
      overallAcc.offTopic++;
      splitAcc.offTopic++;
      if (item.isTrap) {
        overallAcc.trapTotal++;
        splitAcc.trapTotal++;
      }

      // Test at standard RAG confidence threshold (0.22) across entire active corpus
      const results = await VectorStore.search(queryVector, docIds, {
        topK: 5,
        queryText: item.query,
        minScore: 0.22,
      });

      const refused = results.length === 0;
      if (refused) {
        overallAcc.successfulRefusals++;
        splitAcc.successfulRefusals++;
        if (item.isTrap) {
          overallAcc.trapRefused++;
          splitAcc.trapRefused++;
        }
      } else {
        // Record false positive failure
        failedQueries.push({
          id: item.id,
          split,
          category: cat,
          isTrap: item.isTrap,
          query: item.query,
          expectedAnswerSpan: item.expectedAnswerSpan,
          failureType: 'FALSE_POSITIVE_OFF_TOPIC',
          retrievedChunks: results.map((r, idx) => ({
            rank: idx + 1,
            docName: docMap.get(r.chunk.documentId.toString()) || 'Unknown',
            pageNumber: r.chunk.pageNumber,
            score: Math.round(r.score * 1000) / 1000,
            snippet: r.chunk.text.slice(0, 140).replace(/\s+/g, ' '),
          })),
        });
      }

      const statusLabel = refused ? 'REFUSED (OK)' : 'FALSE POSITIVE';
      const trapLabel = item.isTrap ? '[TRAP]' : '[DIST]';
      console.log(`  [${item.id}] [${split.padEnd(13)}] [${cat.padEnd(10)}] ${trapLabel} ${statusLabel.padEnd(14)} | ${item.query.slice(0, 50)}...`);
      continue;
    }

    // Grounded query evaluation: restrict retrieval to document(s) targeted by query
    overallAcc.relevant++;
    splitAcc.relevant++;

    const targetDocIds: string[] = [];
    if (item.targetDocs && item.targetDocs.length > 0) {
      for (const targetName of item.targetDocs) {
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

    const results = await VectorStore.search(queryVector, queryDocIds, {
      topK: 5,
      queryText: item.query,
      minScore: 0.1,
    });

    let strictFirstRank = 0;
    let normFirstRank = 0;
    let hasKeywordMatchInTop3 = false;

    for (let rank = 1; rank <= results.length; rank++) {
      const res = results[rank - 1];
      const docName = docMap.get(res.chunk.documentId.toString()) || '';

      const targetDocs = item.targetDocs || [];
      const isTargetDoc =
        targetDocs.length === 0 ||
        targetDocs.some(
          (target) =>
            docName.toLowerCase().includes(target.toLowerCase()) ||
            target.toLowerCase().includes(docName.toLowerCase())
        );

      const chunkLower = res.chunk.text.toLowerCase();
      const expectedSpan = item.expectedAnswerSpan || '';

      // Strict matching: raw case-insensitive substring of chunk
      const strictHit = isTargetDoc && expectedSpan && chunkLower.includes(expectedSpan.toLowerCase());

      // Normalized matching: math, Greek, LaTeX, subscript/superscript aware
      const normHit = isTargetDoc && expectedSpan && containsNormalized(res.chunk.text, expectedSpan);

      const keyPhraseHit = item.keyPhrases.some(
        (phrase) =>
          chunkLower.includes(phrase.toLowerCase()) ||
          containsNormalized(res.chunk.text, phrase)
      );

      if (strictHit && strictFirstRank === 0) {
        strictFirstRank = rank;
      }

      if ((normHit || (isTargetDoc && keyPhraseHit)) && normFirstRank === 0) {
        normFirstRank = rank;
      }

      if (rank <= 3 && keyPhraseHit) {
        hasKeywordMatchInTop3 = true;
      }
    }

    // Accumulate Strict Metrics
    if (strictFirstRank === 1) {
      overallAcc.strictH1++;
      splitAcc.strictH1++;
      categoryStats[cat].strictH1++;
    }
    if (strictFirstRank > 0 && strictFirstRank <= 3) {
      overallAcc.strictH3++;
      splitAcc.strictH3++;
    }
    if (strictFirstRank > 0 && strictFirstRank <= 5) {
      overallAcc.strictH5++;
      splitAcc.strictH5++;
      categoryStats[cat].strictH5++;
    }
    if (strictFirstRank > 0) {
      overallAcc.strictMrrSum += 1.0 / strictFirstRank;
      splitAcc.strictMrrSum += 1.0 / strictFirstRank;
    }

    // Accumulate Normalized Metrics
    if (normFirstRank === 1) {
      overallAcc.normH1++;
      splitAcc.normH1++;
      categoryStats[cat].normH1++;
    }
    if (normFirstRank > 0 && normFirstRank <= 3) {
      overallAcc.normH3++;
      splitAcc.normH3++;
    }
    if (normFirstRank > 0 && normFirstRank <= 5) {
      overallAcc.normH5++;
      splitAcc.normH5++;
      categoryStats[cat].normH5++;
    }
    if (normFirstRank > 0) {
      overallAcc.normMrrSum += 1.0 / normFirstRank;
      splitAcc.normMrrSum += 1.0 / normFirstRank;
      categoryStats[cat].normMrrSum += 1.0 / normFirstRank;
    }

    if (hasKeywordMatchInTop3) {
      overallAcc.keywordMatches++;
      splitAcc.keywordMatches++;
    }

    // Track retrieval misses (normFirstRank === 0)
    if (normFirstRank === 0) {
      failedQueries.push({
        id: item.id,
        split,
        category: cat,
        query: item.query,
        expectedAnswerSpan: item.expectedAnswerSpan,
        failureType: 'MISSED_GROUND_TRUTH',
        firstMatchRank: 0,
        retrievedChunks: results.map((r, idx) => ({
          rank: idx + 1,
          docName: docMap.get(r.chunk.documentId.toString()) || 'Unknown',
          pageNumber: r.chunk.pageNumber,
          score: Math.round(r.score * 1000) / 1000,
          snippet: r.chunk.text.slice(0, 140).replace(/\s+/g, ' '),
        })),
      });
    }

    const rankLabel = normFirstRank > 0 ? `#${normFirstRank}` : 'MISSED';
    const strictLabel = strictFirstRank > 0 ? `[strict:#${strictFirstRank}]` : '[strict:MISS]';
    console.log(
      `  [${item.id}] [${split.padEnd(13)}] [${cat.padEnd(10)}] ${rankLabel.padEnd(6)} ${strictLabel.padEnd(13)} | ${item.query.slice(0, 45)}...`
    );
  }

  const overall = computeSplitMetrics(overallAcc);
  const tuning = computeSplitMetrics(tuningAcc);
  const seenHeldOut = computeSplitMetrics(seenHeldOutAcc);
  const blind = computeSplitMetrics(blindAcc);

  const categoryBreakdown: Record<
    string,
    { total: number; strictH1: number; strictH5: number; normH1: number; normH5: number; normMrr: number }
  > = {};
  for (const [c, s] of Object.entries(categoryStats)) {
    const N = s.total;
    categoryBreakdown[c] = {
      total: N,
      strictH1: N > 0 ? Math.round((s.strictH1 / N) * 1000) / 10 : 0,
      strictH5: N > 0 ? Math.round((s.strictH5 / N) * 1000) / 10 : 0,
      normH1: N > 0 ? Math.round((s.normH1 / N) * 1000) / 10 : 0,
      normH5: N > 0 ? Math.round((s.normH5 / N) * 1000) / 10 : 0,
      normMrr: N > 0 ? Math.round((s.normMrrSum / N) * 1000) / 1000 : 0,
    };
  }

  await mongoose.disconnect();

  return {
    totalQueries: dataset.length,
    relevantQueries: overallAcc.relevant,
    offTopicQueries: overallAcc.offTopic,
    overall,
    tuning,
    seenHeldOut,
    blind,
    categoryBreakdown,
    failedQueries,
  };
}

const isDirectRun = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('evaluate.ts');
if (isDirectRun) {
  runEvaluation()
    .then((metrics) => {
      console.log('\n======================================================');
      console.log('   RETRIEVAL BENCHMARK: STRICT vs NORMALIZED');
      console.log('======================================================');
      console.log('Tuning (n=29):');
      console.log(`  Strict:     Hit@1: ${metrics.tuning.strictHitAt1}%, Hit@5: ${metrics.tuning.strictHitAt5}%, MRR: ${metrics.tuning.strictMrr}`);
      console.log(`  Normalized: Hit@1: ${metrics.tuning.normHitAt1}%, Hit@5: ${metrics.tuning.normHitAt5}%, MRR: ${metrics.tuning.normMrr}`);

      console.log('\nSeen Held-Out (n=16):');
      console.log(`  Strict:     Hit@1: ${metrics.seenHeldOut.strictHitAt1}%, Hit@5: ${metrics.seenHeldOut.strictHitAt5}%, MRR: ${metrics.seenHeldOut.strictMrr}`);
      console.log(`  Normalized: Hit@1: ${metrics.seenHeldOut.normHitAt1}%, Hit@5: ${metrics.seenHeldOut.normHitAt5}%, MRR: ${metrics.seenHeldOut.normMrr}`);

      console.log('\nBlind Set (q61-q75, n=15):');
      console.log(`  Strict:     Hit@1: ${metrics.blind.strictHitAt1}%, Hit@5: ${metrics.blind.strictHitAt5}%, MRR: ${metrics.blind.strictMrr}`);
      console.log(`  Normalized: Hit@1: ${metrics.blind.normHitAt1}%, Hit@5: ${metrics.blind.normHitAt5}%, MRR: ${metrics.blind.normMrr}`);

      console.log('\nOverall Grounded (n=60):');
      console.log(`  Strict:     Hit@1: ${metrics.overall.strictHitAt1}%, Hit@5: ${metrics.overall.strictHitAt5}%, MRR: ${metrics.overall.strictMrr}`);
      console.log(`  Normalized: Hit@1: ${metrics.overall.normHitAt1}%, Hit@5: ${metrics.overall.normHitAt5}%, MRR: ${metrics.overall.normMrr}`);
      console.log('======================================================\n');
    })
    .catch(console.error);
}
