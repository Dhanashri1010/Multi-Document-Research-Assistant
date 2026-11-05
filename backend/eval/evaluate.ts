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
  query: string;
  targetDocs?: string[];
  targetPage?: number;
  targetPages?: number[];
  keyPhrases: string[];
  isOffTopic?: boolean;
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
  categoryBreakdown: Record<string, { total: number; hitAt1: number; hitAt3: number; hitAt5: number; mrr: number }>;
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

    let doc = await DocumentModel.findOne({ originalName: paper.name, status: 'ready' });

    if (!doc) {
      const destPath = path.join(uploadDir, paper.filename);
      fs.copyFileSync(samplePath, destPath);

      doc = await DocumentModel.create({
        filename: paper.filename,
        originalName: paper.name,
        fileSize: fs.statSync(destPath).size,
        mimeType: 'application/pdf',
        filePath: destPath,
        status: 'uploaded',
      });

      await IngestionService.processDocument(doc._id);
      doc = await DocumentModel.findById(doc._id);
    }

    if (doc) {
      docIds.push(doc._id.toString());
      docMap.set(doc._id.toString(), paper.name);
    }
  }

  return { docIds, docMap };
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

  let hits1 = 0;
  let hits3 = 0;
  let hits5 = 0;
  let reciprocalRankSum = 0;
  let keywordMatches = 0;

  let totalOffTopic = 0;
  let successfulRefusals = 0;
  let totalRelevant = 0;

  const categoryStats: Record<string, { total: number; h1: number; h3: number; h5: number; mrrSum: number }> = {};

  console.log(`\n======================================================`);
  console.log(`   RUNNING EVALUATION OVER ${dataset.length} BENCHMARK QUERIES`);
  console.log(`   Corpus: 6 Academic Papers (${docIds.length} active documents)`);
  console.log(`======================================================\n`);

  for (const item of dataset) {
    const cat = item.category || 'single-doc';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { total: 0, h1: 0, h3: 0, h5: 0, mrrSum: 0 };
    }
    categoryStats[cat].total++;

    const queryVector = await embeddingProvider.embedQuery(item.query);

    // Off-Topic / Distractor query evaluation
    if (item.isOffTopic) {
      totalOffTopic++;
      // Test at standard RAG confidence threshold (0.22)
      const results = await VectorStore.search(queryVector, docIds, {
        topK: 5,
        queryText: item.query,
        minScore: 0.22,
      });

      const refused = results.length === 0;
      if (refused) {
        successfulRefusals++;
      }
      const statusLabel = refused ? 'REFUSED (OK)' : 'FALSE POSITIVE';
      console.log(`  [${item.id}] [${cat.padEnd(11)}] ${statusLabel.padEnd(16)} | ${item.query.slice(0, 60)}...`);
      continue;
    }

    // Grounded query evaluation
    totalRelevant++;
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
      hits1++;
      categoryStats[cat].h1++;
    }
    if (firstMatchRank > 0 && firstMatchRank <= 3) {
      hits3++;
      categoryStats[cat].h3++;
    }
    if (firstMatchRank > 0 && firstMatchRank <= 5) {
      hits5++;
      categoryStats[cat].h5++;
    }

    if (firstMatchRank > 0) {
      const rr = 1.0 / firstMatchRank;
      reciprocalRankSum += rr;
      categoryStats[cat].mrrSum += rr;
    }

    if (hasKeywordMatchInTop3) {
      keywordMatches++;
    }

    const rankDisplay = firstMatchRank > 0 ? `#${firstMatchRank}` : 'MISSED';
    console.log(`  [${item.id}] [${cat.padEnd(11)}] ${rankDisplay.padEnd(7)} | ${item.query.slice(0, 60)}...`);
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

  const N = totalRelevant;
  const metrics: EvalMetrics = {
    totalQueries: dataset.length,
    relevantQueries: totalRelevant,
    offTopicQueries: totalOffTopic,
    hitAt1: N > 0 ? Math.round((hits1 / N) * 1000) / 10 : 0,
    hitAt3: N > 0 ? Math.round((hits3 / N) * 1000) / 10 : 0,
    hitAt5: N > 0 ? Math.round((hits5 / N) * 1000) / 10 : 0,
    mrr: N > 0 ? Math.round((reciprocalRankSum / N) * 1000) / 1000 : 0,
    keywordMatchAt3: N > 0 ? Math.round((keywordMatches / N) * 1000) / 10 : 0,
    offTopicRefusalAccuracy: totalOffTopic > 0 ? Math.round((successfulRefusals / totalOffTopic) * 1000) / 10 : 100,
    categoryBreakdown,
  };

  console.log('\n======================================================');
  console.log('              EVALUATION BENCHMARK METRICS            ');
  console.log('======================================================');
  console.log(`  Total Dataset Queries: ${metrics.totalQueries} (${metrics.relevantQueries} grounded + ${metrics.offTopicQueries} off-topic)`);
  console.log(`  Hit@1                : ${metrics.hitAt1}%`);
  console.log(`  Hit@3                : ${metrics.hitAt3}%`);
  console.log(`  Hit@5                : ${metrics.hitAt5}%`);
  console.log(`  MRR                  : ${metrics.mrr}`);
  console.log(`  Keyword Match @ 3    : ${metrics.keywordMatchAt3}%`);
  console.log(`  Off-Topic Refusal    : ${metrics.offTopicRefusalAccuracy}%`);
  console.log('------------------------------------------------------');
  console.log('  CATEGORY BREAKDOWN:');
  for (const [cat, b] of Object.entries(metrics.categoryBreakdown)) {
    console.log(`    - ${cat.padEnd(12)} (N=${b.total}): Hit@1=${b.hitAt1}% | Hit@3=${b.hitAt3}% | Hit@5=${b.hitAt5}% | MRR=${b.mrr}`);
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
