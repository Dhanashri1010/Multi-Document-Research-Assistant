import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { VectorStore } from '../src/services/ai/vectorStore.js';
import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';

async function diagnose() {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const datasetPath = fs.existsSync(path.resolve(process.cwd(), 'eval', 'dataset.json'))
    ? path.resolve(process.cwd(), 'eval', 'dataset.json')
    : path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');

  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const readyDocs = await DocumentModel.find({ status: 'ready' }).lean();
  const docIds = readyDocs.map((d) => d._id.toString());
  const docMap = new Map(readyDocs.map((d) => [d._id.toString(), d.originalName]));

  const targetIds = ['q04', 'q06', 'q13', 'q53', 'q54', 'q07', 'q14', 'q58', 'q60'];
  const embeddingProvider = getEmbeddingProvider();

  console.log('========================================================================');
  console.log(`DIAGNOSING ${targetIds.length} FALSE REFUSAL QUERIES`);
  console.log(`Pre-LLM Cosine Threshold: ${config.preLlmCosineThreshold ?? 0.28}`);
  console.log('========================================================================\n');

  for (const id of targetIds) {
    const item = dataset.find((q: any) => q.id === id);
    if (!item) {
      console.log(`Query ${id} not found in dataset.`);
      continue;
    }

    const queryEmbedding = await embeddingProvider.embedQuery(item.query);
    const scoredChunks = await VectorStore.search(queryEmbedding, docIds, {
      topK: 5,
      minScore: 0.1,
      queryText: item.query,
      hybridWeight: 0.85,
    });

    const bestDenseSimilarity = scoredChunks.length > 0
      ? Math.max(...scoredChunks.map((c) => c.denseScore ?? 0))
      : 0;
    const gateThreshold = config.preLlmCosineThreshold ?? 0.28;
    const gateTriggered = bestDenseSimilarity < gateThreshold;

    const span = (item.expectedAnswerSpan || '').toLowerCase();
    let hitRank = 0;
    for (let r = 0; r < scoredChunks.length; r++) {
      const chunkText = scoredChunks[r].chunk.text.toLowerCase();
      if (span && chunkText.includes(span)) {
        hitRank = r + 1;
        break;
      }
    }

    // Also check if any keyPhrases match
    let keyPhraseRank = 0;
    if (hitRank === 0 && item.keyPhrases && item.keyPhrases.length > 0) {
      for (let r = 0; r < scoredChunks.length; r++) {
        const chunkText = scoredChunks[r].chunk.text.toLowerCase();
        const matched = item.keyPhrases.some((kp: string) => chunkText.includes(kp.toLowerCase()));
        if (matched) {
          keyPhraseRank = r + 1;
          break;
        }
      }
    }

    let cause = '';
    if (gateTriggered) {
      cause = `PRE-LLM GATE (best cosine: ${bestDenseSimilarity.toFixed(3)} < ${gateThreshold})`;
    } else if (hitRank === 0 && keyPhraseRank === 0) {
      cause = `RETRIEVAL FAILURE (expected answer span "${item.expectedAnswerSpan}" absent from top-5 chunks)`;
    } else {
      cause = `LLM FAILURE (evidence present in top-5 chunks at rank ${hitRank || keyPhraseRank}, best cosine ${bestDenseSimilarity.toFixed(3)}, but LLM returned hasInsufficientEvidence)`;
    }

    console.log(`------------------------------------------------------------------------`);
    console.log(`ID: ${item.id} | Split: ${item.split} | Category: ${item.category}`);
    console.log(`Query: "${item.query}"`);
    console.log(`Expected Span: "${item.expectedAnswerSpan}"`);
    console.log(`Target Docs: ${JSON.stringify(item.targetDocs)}`);
    console.log(`Best Dense Score: ${bestDenseSimilarity.toFixed(3)} | Gate Tripped: ${gateTriggered}`);
    console.log(`Answer Span Hit Rank: ${hitRank > 0 ? `Rank ${hitRank}` : 'NOT FOUND IN TOP 5'}`);
    console.log(`Key Phrase Hit Rank: ${keyPhraseRank > 0 ? `Rank ${keyPhraseRank}` : 'NOT FOUND IN TOP 5'}`);
    console.log(`DIAGNOSED CAUSE: >>> ${cause} <<<`);
    console.log(`\nTop 5 Retrieved Chunks:`);

    scoredChunks.forEach((sc, idx) => {
      const dName = docMap.get(sc.chunk.documentId.toString()) || 'Unknown';
      const snippet = sc.chunk.text.replace(/\s+/g, ' ').slice(0, 180);
      console.log(`  [${idx + 1}] Doc: "${dName}" | p.${sc.chunk.pageNumber} | Score: ${sc.score.toFixed(3)} (dense: ${sc.denseScore?.toFixed(3)}, lexical: ${sc.lexicalScore?.toFixed(3)})`);
      console.log(`      "${snippet}..."`);
    });
    console.log('');
  }

  await mongoose.disconnect();
}

diagnose().catch((err) => {
  console.error(err);
  process.exit(1);
});

