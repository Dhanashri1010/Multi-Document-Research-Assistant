import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { DocumentChunkModel } from '../src/models/DocumentChunk.js';
import { DocumentModel } from '../src/models/Document.js';
import { config } from '../src/config/env.js';
import { containsNormalized } from '../eval/textNormalizer.js';

async function audit() {
  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  await mongoose.connect(mongoUri);

  const datasetPath = path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  console.log(`Auditing ${dataset.length} queries in dataset with normalized matching...`);

  const stillMissing: any[] = [];
  const normalizedFixed: any[] = [];

  for (const q of dataset) {
    if (q.isOffTopic) continue;

    const span = q.expectedAnswerSpan;
    if (!span) continue;

    const targetDocs = q.targetDocs || [];
    const matchingDocs = await DocumentModel.find({
      $or: targetDocs.map((td: string) => ({
        originalName: { $regex: new RegExp(td.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
      }))
    }).lean();

    const targetDocIds = matchingDocs.map(d => d._id);

    const allChunks = await DocumentChunkModel.find({
      documentId: { $in: targetDocIds }
    }).lean();

    const verbatimHits = allChunks.filter(c => c.text.toLowerCase().includes(span.toLowerCase()));
    const normHits = allChunks.filter(c => containsNormalized(c.text, span));

    if (verbatimHits.length === 0 && normHits.length > 0) {
      normalizedFixed.push({
        id: q.id,
        split: q.split,
        category: q.category,
        query: q.query,
        span,
        matchingPages: normHits.map(h => h.pageNumber)
      });
    } else if (verbatimHits.length === 0 && normHits.length === 0) {
      stillMissing.push({
        id: q.id,
        split: q.split,
        category: q.category,
        query: q.query,
        span
      });
    }
  }

  console.log(`\n=== FIXED BY NORMALIZATION ALONE (${normalizedFixed.length} queries) ===`);
  normalizedFixed.forEach(f => {
    console.log(`+ [${f.id} | ${f.split} | ${f.category}]: span="${f.span}" matched pages: ${f.matchingPages.join(', ')}`);
  });

  console.log(`\n=== STILL MISSING IN CORPUS (${stillMissing.length} queries) ===`);
  stillMissing.forEach(m => {
    console.log(`- [${m.id} | ${m.split} | ${m.category}]: span="${m.span}" | query="${m.query}"`);
  });

  await mongoose.disconnect();
}

audit().catch(console.error);
