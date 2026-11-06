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
import { containsNormalized } from '../eval/textNormalizer.js';

async function testTuningReranker(rerankerMode: 'on' | 'off') {
  config.reranker = rerankerMode;

  const datasetPath = path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  const tuningQueries = dataset.filter((q: any) => q.split === 'tuning' && !q.isOffTopic);

  const readyDocs = await DocumentModel.find({ status: 'ready' }).lean();
  const docIds = readyDocs.map((d) => d._id.toString());
  const docMap = new Map(readyDocs.map((d) => [d._id.toString(), d.originalName]));

  const embeddingProvider = getEmbeddingProvider();

  let h1 = 0, h3 = 0, h5 = 0, mrrSum = 0;

  for (const item of tuningQueries) {
    const queryVec = await embeddingProvider.embedQuery(item.query);
    const results = await VectorStore.search(queryVec, docIds, {
      topK: 5,
      queryText: item.query,
      minScore: 0.1,
    });

    let firstMatchRank = 0;
    for (let rank = 1; rank <= results.length; rank++) {
      const res = results[rank - 1];
      const docName = docMap.get(res.chunk.documentId.toString()) || '';

      const targetDocs = item.targetDocs || [];
      const isTargetDoc = targetDocs.some(
        (target: string) =>
          docName.toLowerCase().includes(target.toLowerCase()) ||
          target.toLowerCase().includes(docName.toLowerCase())
      );

      const chunkTextLower = res.chunk.text.toLowerCase();
      const containsAnswerSpan = item.expectedAnswerSpan
        ? chunkTextLower.includes(item.expectedAnswerSpan.toLowerCase()) ||
          containsNormalized(res.chunk.text, item.expectedAnswerSpan)
        : false;
      const containsKeyPhrase = item.keyPhrases.some((phrase: string) =>
        chunkTextLower.includes(phrase.toLowerCase()) ||
        containsNormalized(res.chunk.text, phrase)
      );

      const isRelevant = isTargetDoc && (containsAnswerSpan || containsKeyPhrase);
      if (isRelevant && firstMatchRank === 0) {
        firstMatchRank = rank;
      }
    }

    if (firstMatchRank === 1) h1++;
    if (firstMatchRank > 0 && firstMatchRank <= 3) h3++;
    if (firstMatchRank > 0 && firstMatchRank <= 5) h5++;
    if (firstMatchRank > 0) mrrSum += 1.0 / firstMatchRank;
  }

  const n = tuningQueries.length;
  console.log(`[RERANKER=${rerankerMode.toUpperCase()}] Tuning Set (n=${n}): Hit@1=${((h1/n)*100).toFixed(1)}% | Hit@3=${((h3/n)*100).toFixed(1)}% | Hit@5=${((h5/n)*100).toFixed(1)}% | MRR=${(mrrSum/n).toFixed(3)}`);
}

async function run() {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  console.log('--- COMPARING RERANKER MODES ON TUNING SET ---');
  await testTuningReranker('off');
  await testTuningReranker('on');

  await mongoose.disconnect();
}

run().catch(console.error);

