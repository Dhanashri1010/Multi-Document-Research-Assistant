import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables before other imports
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { DocumentModel } from '../src/models/Document.js';
import { DocumentChunkModel } from '../src/models/DocumentChunk.js';
import { IngestionService } from '../src/services/documents/ingestionService.js';
import { VectorStore } from '../src/services/ai/vectorStore.js';
import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';

interface BenchmarkItem {
  id: string;
  query: string;
  targetDoc: string;
  targetPage: number;
  keyPhrases: string[];
}

export interface EvalMetrics {
  totalQueries: number;
  hitAt1: number;
  hitAt3: number;
  hitAt5: number;
  mrr: number;
  keywordMatchAt3: number;
}

async function ensureSampleDocuments(): Promise<{ doc1Id: string; doc2Id: string }> {
  const sample1 = fs.existsSync(path.resolve(process.cwd(), 'samples', 'attention_is_all_you_need.pdf'))
    ? path.resolve(process.cwd(), 'samples', 'attention_is_all_you_need.pdf')
    : path.resolve(process.cwd(), '..', 'samples', 'attention_is_all_you_need.pdf');

  const sample2 = fs.existsSync(path.resolve(process.cwd(), 'samples', 'lora_low_rank_adaptation.pdf'))
    ? path.resolve(process.cwd(), 'samples', 'lora_low_rank_adaptation.pdf')
    : path.resolve(process.cwd(), '..', 'samples', 'lora_low_rank_adaptation.pdf');

  // Check if documents already exist and are ready
  let doc1 = await DocumentModel.findOne({ originalName: 'Attention Is All You Need', status: 'ready' });
  let doc2 = await DocumentModel.findOne({ originalName: 'LoRA: Low-Rank Adaptation', status: 'ready' });

  if (!doc1) {
    const uploadDir = path.resolve(process.cwd(), config.uploadDir);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const p1 = path.join(uploadDir, 'eval_attention.pdf');
    fs.copyFileSync(sample1, p1);

    doc1 = await DocumentModel.create({
      filename: 'eval_attention.pdf',
      originalName: 'Attention Is All You Need',
      fileSize: fs.statSync(p1).size,
      mimeType: 'application/pdf',
      filePath: p1,
      status: 'uploaded',
    });
    await IngestionService.processDocument(doc1._id);
    doc1 = await DocumentModel.findById(doc1._id);
  }

  if (!doc2) {
    const uploadDir = path.resolve(process.cwd(), config.uploadDir);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const p2 = path.join(uploadDir, 'eval_lora.pdf');
    fs.copyFileSync(sample2, p2);

    doc2 = await DocumentModel.create({
      filename: 'eval_lora.pdf',
      originalName: 'LoRA: Low-Rank Adaptation',
      fileSize: fs.statSync(p2).size,
      mimeType: 'application/pdf',
      filePath: p2,
      status: 'uploaded',
    });
    await IngestionService.processDocument(doc2._id);
    doc2 = await DocumentModel.findById(doc2._id);
  }

  return {
    doc1Id: doc1!._id.toString(),
    doc2Id: doc2!._id.toString(),
  };
}

export async function runEvaluation(): Promise<EvalMetrics> {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const datasetPath = fs.existsSync(path.resolve(process.cwd(), 'eval', 'dataset.json'))
    ? path.resolve(process.cwd(), 'eval', 'dataset.json')
    : path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');
  const dataset: BenchmarkItem[] = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const { doc1Id, doc2Id } = await ensureSampleDocuments();
  const docIds = [doc1Id, doc2Id];

  const docMap = new Map<string, string>([
    [doc1Id, 'Attention Is All You Need'],
    [doc2Id, 'LoRA: Low-Rank Adaptation'],
  ]);

  const embeddingProvider = getEmbeddingProvider();

  let hits1 = 0;
  let hits3 = 0;
  let hits5 = 0;
  let reciprocalRankSum = 0;
  let keywordMatches = 0;

  console.log(`\nEvaluating ${dataset.length} queries across benchmark documents...\n`);

  for (const item of dataset) {
    const queryVector = await embeddingProvider.embedQuery(item.query);
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
      const isTargetDoc = docName.toLowerCase().includes(item.targetDoc.toLowerCase()) ||
                          item.targetDoc.toLowerCase().includes(docName.toLowerCase());

      const pageMatches =
        res.chunk.pageNumber === item.targetPage ||
        (res.chunk.pageStart && res.chunk.pageEnd &&
         item.targetPage >= res.chunk.pageStart && item.targetPage <= res.chunk.pageEnd);

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

    if (firstMatchRank === 1) hits1++;
    if (firstMatchRank > 0 && firstMatchRank <= 3) hits3++;
    if (firstMatchRank > 0 && firstMatchRank <= 5) hits5++;

    if (firstMatchRank > 0) {
      reciprocalRankSum += 1.0 / firstMatchRank;
    }

    if (hasKeywordMatchInTop3) {
      keywordMatches++;
    }

    const rankDisplay = firstMatchRank > 0 ? `#${firstMatchRank}` : 'MISSED';
    console.log(`  [${item.id}] ${rankDisplay.padEnd(7)} | ${item.query.slice(0, 70)}...`);
  }

  const N = dataset.length;
  const metrics: EvalMetrics = {
    totalQueries: N,
    hitAt1: Math.round((hits1 / N) * 1000) / 10,
    hitAt3: Math.round((hits3 / N) * 1000) / 10,
    hitAt5: Math.round((hits5 / N) * 1000) / 10,
    mrr: Math.round((reciprocalRankSum / N) * 1000) / 1000,
    keywordMatchAt3: Math.round((keywordMatches / N) * 1000) / 10,
  };

  console.log('\n======================================================');
  console.log('              EVALUATION BENCHMARK METRICS            ');
  console.log('======================================================');
  console.log(`  Queries Evaluated    : ${metrics.totalQueries}`);
  console.log(`  Hit@1                : ${metrics.hitAt1}%`);
  console.log(`  Hit@3                : ${metrics.hitAt3}%`);
  console.log(`  Hit@5                : ${metrics.hitAt5}%`);
  console.log(`  MRR                  : ${metrics.mrr}`);
  console.log(`  Keyword Match @ 3    : ${metrics.keywordMatchAt3}%`);
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
