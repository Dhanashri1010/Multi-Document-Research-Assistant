import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables before other imports
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { DocumentModel } from '../src/models/Document.js';
import { IngestionService } from '../src/services/documents/ingestionService.js';
import { VectorStore } from '../src/services/ai/vectorStore.js';
import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';

export interface BenchmarkItem {
  id: string;
  category: 'single-doc' | 'table' | 'equation' | 'paraphrased' | 'multi-doc' | 'off-topic';
  split?: 'tuning' | 'held-out';
  query: string;
  targetDocs?: string[];
  targetPage?: number;
  targetPages?: number[];
  keyPhrases: string[];
  isOffTopic?: boolean;
  isTrap?: boolean;
}

export interface SplitMetrics {
  totalQueries: number;
  relevantQueries: number;
  offTopicQueries: number;
  trapQueries: number;
  hitAt1: number;
  hitAt3: number;
  hitAt5: number;
  mrr: number;
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
  hitAt1: number;
  hitAt3: number;
  hitAt5: number;
  mrr: number;
  keywordMatchAt3: number;
  offTopicRefusalAccuracy: number;
  overall: SplitMetrics;
  tuning: SplitMetrics;
  heldOut: SplitMetrics;
  categoryBreakdown: Record<string, { total: number; hitAt1: number; hitAt3: number; hitAt5: number; mrr: number }>;
  failedQueries: FailedQueryRecord[];
}

const BENCHMARK_PAPERS = [
  { sampleFile: 'attention_is_all_you_need.pdf', name: 'Attention Is All You Need', filename: 'eval_attention.pdf' },
  { sampleFile: 'lora_low_rank_adaptation.pdf', name: 'LoRA: Low-Rank Adaptation', filename: 'eval_lora.pdf' },
  { sampleFile: 'bert_pretraining_deep_bidirectional.pdf', name: 'BERT: Pre-training of Deep Bidirectional Transformers', filename: 'eval_bert.pdf' },
  { sampleFile: 'resnet_deep_residual_learning.pdf', name: 'Deep Residual Learning for Image Recognition', filename: 'eval_resnet.pdf' },
  { sampleFile: 'gpt3_language_models_few_shot.pdf', name: 'Language Models are Few-Shot Learners', filename: 'eval_gpt3.pdf' },
  { sampleFile: 'adam_stochastic_optimization.pdf', name: 'Adam: A Method for Stochastic Optimization', filename: 'eval_adam.pdf' },
];

async function ensureSampleDocuments(): Promise<{ docIds: string[]; docMap: Map<string, string> }> {
  const uploadDir = path.resolve(process.cwd(), config.uploadDir);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const docIds: string[] = [];
  const docMap = new Map<string, string>();

  for (const paper of BENCHMARK_PAPERS) {
    const samplePath = fs.existsSync(path.resolve(process.cwd(), 'samples', paper.sampleFile))
      ? path.resolve(process.cwd(), 'samples', paper.sampleFile)
      : path.resolve(process.cwd(), '..', 'samples', paper.sampleFile);

    const destPath = path.join(uploadDir, paper.filename);
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
  h1: number;
  h3: number;
  h5: number;
  mrrSum: number;
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
    h1: 0,
    h3: 0,
    h5: 0,
    mrrSum: 0,
    keywordMatches: 0,
    successfulRefusals: 0,
  };
}

function computeSplitMetrics(acc: SplitAccumulator): SplitMetrics {
  const N = acc.relevant;
  return {
    totalQueries: acc.total,
    relevantQueries: acc.relevant,
    offTopicQueries: acc.offTopic,
    trapQueries: acc.trapTotal,
    hitAt1: N > 0 ? Math.round((acc.h1 / N) * 1000) / 10 : 0,
    hitAt3: N > 0 ? Math.round((acc.h3 / N) * 1000) / 10 : 0,
    hitAt5: N > 0 ? Math.round((acc.h5 / N) * 1000) / 10 : 0,
    mrr: N > 0 ? Math.round((acc.mrrSum / N) * 1000) / 1000 : 0,
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
  const heldOutAcc = createAccumulator();

  const categoryStats: Record<string, { total: number; h1: number; h3: number; h5: number; mrrSum: number }> = {};
  const failedQueries: FailedQueryRecord[] = [];

  console.log(`\n======================================================`);
  console.log(`   RUNNING EVALUATION OVER ${dataset.length} BENCHMARK QUERIES`);
  console.log(`   Corpus: 6 Academic Papers (${docIds.length} active documents)`);
  console.log(`======================================================\n`);

  for (const item of dataset) {
    const split = item.split || 'tuning';
    const cat = item.category || 'single-doc';
    const splitAcc = split === 'held-out' ? heldOutAcc : tuningAcc;

    overallAcc.total++;
    splitAcc.total++;

    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, h1: 0, h3: 0, h5: 0, mrrSum: 0 };
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

      // Test at standard RAG confidence threshold (0.22)
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
      console.log(`  [${item.id}] [${split.padEnd(8)}] [${cat.padEnd(10)}] ${trapLabel} ${statusLabel.padEnd(14)} | ${item.query.slice(0, 55)}...`);
      continue;
    }

    // Grounded query evaluation
    overallAcc.relevant++;
    splitAcc.relevant++;

    const results = await VectorStore.search(queryVector, docIds, {
      topK: 5,
      queryText: item.query,
      minScore: 0.1,
    });

    let firstMatchRank = 0;
    let hasKeywordMatchInTop3 = false;

    for (let rank = 1; rank <= results.length; rank++) {
      const res = results[rank - 1];
      const docName = docMap.get(res.chunk.documentId.toString()) || '';

      const targetDocs = item.targetDocs || [];
      const isTargetDoc = targetDocs.some(
        (target) =>
          docName.toLowerCase().includes(target.toLowerCase()) ||
          target.toLowerCase().includes(docName.toLowerCase())
      );

      const targetPage = item.targetPage;
      const targetPages = item.targetPages || (targetPage ? [targetPage] : []);
      const pageMatches =
        targetPages.includes(res.chunk.pageNumber) ||
        (res.chunk.pageStart &&
          res.chunk.pageEnd &&
          targetPages.some((p) => p >= res.chunk.pageStart && p <= res.chunk.pageEnd));

      const hasKeyPhrase = item.keyPhrases.some((phrase) =>
        res.chunk.text.toLowerCase().includes(phrase.toLowerCase())
      );

      const isRelevant = isTargetDoc && (pageMatches || hasKeyPhrase);

      if (isRelevant && firstMatchRank === 0) {
        firstMatchRank = rank;
      }

      if (rank <= 3 && hasKeyPhrase) {
        hasKeywordMatchInTop3 = true;
      }
    }

    if (firstMatchRank === 1) {
      overallAcc.h1++;
      splitAcc.h1++;
      categoryStats[cat].h1++;
    }
    if (firstMatchRank > 0 && firstMatchRank <= 3) {
      overallAcc.h3++;
      splitAcc.h3++;
      categoryStats[cat].h3++;
    }
    if (firstMatchRank > 0 && firstMatchRank <= 5) {
      overallAcc.h5++;
      splitAcc.h5++;
      categoryStats[cat].h5++;
    }

    if (firstMatchRank > 0) {
      const rr = 1.0 / firstMatchRank;
      overallAcc.mrrSum += rr;
      splitAcc.mrrSum += rr;
      categoryStats[cat].mrrSum += rr;
    } else {
      // Record missed ground truth failure
      failedQueries.push({
        id: item.id,
        split,
        category: cat,
        query: item.query,
        failureType: 'MISSED_GROUND_TRUTH',
        retrievedChunks: results.map((r, idx) => ({
          rank: idx + 1,
          docName: docMap.get(r.chunk.documentId.toString()) || 'Unknown',
          pageNumber: r.chunk.pageNumber,
          score: Math.round(r.score * 1000) / 1000,
          snippet: r.chunk.text.slice(0, 140).replace(/\s+/g, ' '),
        })),
      });
    }

    if (hasKeywordMatchInTop3) {
      overallAcc.keywordMatches++;
      splitAcc.keywordMatches++;
    }

    const rankDisplay = firstMatchRank > 0 ? `#${firstMatchRank}` : 'MISSED';
    console.log(`  [${item.id}] [${split.padEnd(8)}] [${cat.padEnd(10)}] ${rankDisplay.padEnd(6)} | ${item.query.slice(0, 55)}...`);
  }

  const categoryBreakdown: EvalMetrics['categoryBreakdown'] = {};
  for (const [c, s] of Object.entries(categoryStats)) {
    if (c === 'off-topic') continue;
    categoryBreakdown[c] = {
      total: s.total,
      hitAt1: Math.round((s.h1 / s.total) * 1000) / 10,
      hitAt3: Math.round((s.h3 / s.total) * 1000) / 10,
      hitAt5: Math.round((s.h5 / s.total) * 1000) / 10,
      mrr: Math.round((s.mrrSum / s.total) * 1000) / 1000,
    };
  }

  const overall = computeSplitMetrics(overallAcc);
  const tuning = computeSplitMetrics(tuningAcc);
  const heldOut = computeSplitMetrics(heldOutAcc);

  const metrics: EvalMetrics = {
    totalQueries: dataset.length,
    relevantQueries: overall.relevantQueries,
    offTopicQueries: overall.offTopicQueries,
    hitAt1: overall.hitAt1,
    hitAt3: overall.hitAt3,
    hitAt5: overall.hitAt5,
    mrr: overall.mrr,
    keywordMatchAt3: overall.keywordMatchAt3,
    offTopicRefusalAccuracy: overall.offTopicRefusalAccuracy,
    overall,
    tuning,
    heldOut,
    categoryBreakdown,
    failedQueries,
  };

  console.log('\n======================================================');
  console.log('              EVALUATION BENCHMARK METRICS            ');
  console.log('======================================================');
  console.log(`  Total Dataset Queries : ${metrics.totalQueries} (${metrics.relevantQueries} grounded + ${metrics.offTopicQueries} off-topic)`);
  console.log(`  TUNING SET (n=${tuning.totalQueries})   : Hit@1=${tuning.hitAt1}% | Hit@3=${tuning.hitAt3}% | Hit@5=${tuning.hitAt5}% | MRR=${tuning.mrr} | Refusal=${tuning.offTopicRefusalAccuracy}% (Traps: ${tuning.trapRefusalAccuracy}%)`);
  console.log(`  HELD-OUT SET (n=${heldOut.totalQueries}) : Hit@1=${heldOut.hitAt1}% | Hit@3=${heldOut.hitAt3}% | Hit@5=${heldOut.hitAt5}% | MRR=${heldOut.mrr} | Refusal=${heldOut.offTopicRefusalAccuracy}% (Traps: ${heldOut.trapRefusalAccuracy}%)`);
  console.log(`  OVERALL (n=${overall.totalQueries})      : Hit@1=${overall.hitAt1}% | Hit@3=${overall.hitAt3}% | Hit@5=${overall.hitAt5}% | MRR=${overall.mrr} | Refusal=${overall.offTopicRefusalAccuracy}% (Traps: ${overall.trapRefusalAccuracy}%)`);
  console.log('------------------------------------------------------');
  console.log('  CATEGORY BREAKDOWN:');
  for (const [cat, b] of Object.entries(metrics.categoryBreakdown)) {
    console.log(`    - ${cat.padEnd(12)} (n=${b.total}): Hit@1=${b.hitAt1}% | Hit@3=${b.hitAt3}% | Hit@5=${b.hitAt5}% | MRR=${b.mrr}`);
  }
  console.log('------------------------------------------------------');
  console.log(`  FAILED / FALSE-POSITIVE QUERIES (Total: ${failedQueries.length}):`);
  for (const f of failedQueries) {
    console.log(`    [${f.id}] [${f.split}] [${f.category}] Type: ${f.failureType}`);
    console.log(`      Query: "${f.query}"`);
    console.log(`      Top Retrieved Chunks:`);
    for (const ch of f.retrievedChunks) {
      console.log(`        #${ch.rank} [${ch.docName}, p.${ch.pageNumber}, score: ${ch.score}] "${ch.snippet}"`);
    }
  }
  console.log('======================================================\n');

  await mongoose.disconnect();
  return metrics;
}

if (process.argv[1] && process.argv[1].endsWith('evaluate.ts')) {
  runEvaluation().catch((err) => {
    console.error('Evaluation run failed:', err);
    process.exit(1);
  });
}
