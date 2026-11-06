import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';
import { VectorStore } from '../src/services/ai/vectorStore.js';
import { DocumentModel } from '../src/models/Document.js';

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/multi_doc_research');
  const docs = await DocumentModel.find({ status: 'ready' }).lean();
  const docIds = docs.map((d) => d._id.toString());
  const datasetPath = path.resolve(process.cwd(), 'backend', 'eval', 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  const provider = getEmbeddingProvider();
  console.log('Calibrating raw cosine similarities on Tuning set (n=34)...');

  const tuningQueries = dataset.filter((q: any) => q.split === 'tuning');
  const heldOutQueries = dataset.filter((q: any) => q.split === 'held-out');

  const scoreQuery = async (q: any) => {
    const emb = await provider.embedQuery(q.query);
    const results = await VectorStore.search(emb, docIds, {
      topK: 6,
      minScore: 0.0,
      queryText: q.query,
    });
    const maxDense = results.length > 0 ? Math.max(...results.map((r) => r.denseScore ?? 0)) : 0;
    return { id: q.id, query: q.query, isOffTopic: Boolean(q.isOffTopic), isTrap: Boolean(q.isTrap), maxDense };
  };

  const tuningResults = [];
  for (const q of tuningQueries) {
    tuningResults.push(await scoreQuery(q));
  }

  const grounded = tuningResults.filter((r) => !r.isOffTopic).map((r) => r.maxDense);
  const outOfDomain = tuningResults.filter((r) => r.isOffTopic && !r.isTrap).map((r) => r.maxDense);
  const traps = tuningResults.filter((r) => r.isOffTopic && r.isTrap).map((r) => r.maxDense);

  console.log('\n--- TUNING SET CALIBRATION ---');
  console.log(`Grounded (n=${grounded.length}): min=${Math.min(...grounded).toFixed(4)}, max=${Math.max(...grounded).toFixed(4)}, avg=${(grounded.reduce((a,b)=>a+b,0)/grounded.length).toFixed(4)}`);
  console.log(`Out-of-Domain (n=${outOfDomain.length}): min=${Math.min(...outOfDomain).toFixed(4)}, max=${Math.max(...outOfDomain).toFixed(4)}, avg=${(outOfDomain.reduce((a,b)=>a+b,0)/outOfDomain.length).toFixed(4)}`);
  console.log(`In-Domain Traps (n=${traps.length}): min=${Math.min(...traps).toFixed(4)}, max=${Math.max(...traps).toFixed(4)}, avg=${(traps.reduce((a,b)=>a+b,0)/traps.length).toFixed(4)}`);

  console.log('\nOut-of-Domain scores:');
  tuningResults.filter((r) => r.isOffTopic && !r.isTrap).forEach((r) => {
    console.log(`  [${r.id}] sim=${r.maxDense.toFixed(4)} | ${r.query.slice(0, 70)}`);
  });

  console.log('\nLowest Grounded scores:');
  tuningResults.filter((r) => !r.isOffTopic).sort((a,b)=>a.maxDense-b.maxDense).slice(0, 5).forEach((r) => {
    console.log(`  [${r.id}] sim=${r.maxDense.toFixed(4)} | ${r.query.slice(0, 70)}`);
  });

  // Test Held-out queries
  console.log('\n--- HELD-OUT SET VALIDATION ---');
  const heldOutResults = [];
  for (const q of heldOutQueries) {
    heldOutResults.push(await scoreQuery(q));
  }

  const heldGrounded = heldOutResults.filter((r) => !r.isOffTopic).map((r) => r.maxDense);
  const heldOutOfDomain = heldOutResults.filter((r) => r.isOffTopic && !r.isTrap).map((r) => r.maxDense);
  const heldTraps = heldOutResults.filter((r) => r.isOffTopic && r.isTrap).map((r) => r.maxDense);

  console.log(`Held-out Grounded (n=${heldGrounded.length}): min=${Math.min(...heldGrounded).toFixed(4)}, max=${Math.max(...heldGrounded).toFixed(4)}, avg=${(heldGrounded.reduce((a,b)=>a+b,0)/heldGrounded.length).toFixed(4)}`);
  console.log(`Held-out Out-of-Domain (n=${heldOutOfDomain.length}): min=${Math.min(...heldOutOfDomain).toFixed(4)}, max=${Math.max(...heldOutOfDomain).toFixed(4)}, avg=${(heldOutOfDomain.reduce((a,b)=>a+b,0)/heldOutOfDomain.length).toFixed(4)}`);
  console.log(`Held-out In-Domain Traps (n=${heldTraps.length}): min=${Math.min(...heldTraps).toFixed(4)}, max=${Math.max(...heldTraps).toFixed(4)}, avg=${(heldTraps.reduce((a,b)=>a+b,0)/heldTraps.length).toFixed(4)}`);

  await mongoose.disconnect();
}

main().catch(console.error);

