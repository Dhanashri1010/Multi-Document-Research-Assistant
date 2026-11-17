import { performance } from 'perf_hooks';
import { connectDB, disconnectDB } from '../config/db.js';
import { DocumentModel } from '../models/Document.js';
import { DocumentChunkModel } from '../models/DocumentChunk.js';
import { getEmbeddingProvider } from '../services/ai/embeddingService.js';
import { VectorStore } from '../services/ai/vectorStore.js';

async function runBenchmark() {
  console.log('--- Starting System Performance Benchmark ---');
  await connectDB();

  // 1. MongoDB Query Performance
  console.log('\n[1] MongoDB Query Latency');
  const t0 = performance.now();
  const allDocs = await DocumentModel.find().lean();
  const t1 = performance.now();
  console.log(`- Fetch all ${allDocs.length} documents: ${(t1 - t0).toFixed(2)} ms`);

  const largeDoc = allDocs.find((d) => (d.chunkCount || 0) > 100) || allDocs[0];
  const t2 = performance.now();
  const chunks = await DocumentChunkModel.find({ documentId: largeDoc._id }).lean();
  const t3 = performance.now();
  console.log(`- Fetch ${chunks.length} chunks for "${largeDoc.originalName}": ${(t3 - t2).toFixed(2)} ms`);

  // 2. Embedding Generation Latency
  console.log('\n[2] Embedding Generation Latency (all-MiniLM-L6-v2)');
  const embedder = getEmbeddingProvider();
  const sampleQuery = 'What is the attention mechanism and how does multi-head projection work?';
  const t4 = performance.now();
  const queryEmbedding = await embedder.embedQuery(sampleQuery);
  const t5 = performance.now();
  console.log(`- Embed query (${queryEmbedding.length} dim): ${(t5 - t4).toFixed(2)} ms`);

  const samplePassages = [
    'Attention Is All You Need introduces the Transformer architecture based on self-attention.',
    'LoRA decomposes large weight update matrices into two low-rank matrices.',
    'BERT relies on masked language modeling and next sentence prediction for bidirectional representation.',
  ];
  const t6 = performance.now();
  const _docEmbeddings = await embedder.embedDocuments(samplePassages);
  const t7 = performance.now();
  console.log(`- Batch embed 3 passages: ${(t7 - t6).toFixed(2)} ms (avg ${((t7 - t6) / 3).toFixed(2)} ms/passage)`);

  // 3. Vector Retrieval & RRF Hybrid Search Latency
  console.log('\n[3] Retrieval Latency (Dense Vector + BM25 Lexical + RRF)');
  const readyDocIds = allDocs.slice(0, 5).map((d) => d._id.toString());
  const t8 = performance.now();
  const retrieved = await VectorStore.search(queryEmbedding, readyDocIds, {
    topK: 8,
    minScore: 0.15,
    queryText: sampleQuery,
    hybridWeight: 0.85,
    isBroadQuery: false,
    totalDocChunks: 150,
  });
  const t9 = performance.now();
  console.log(`- Hybrid Search across ${readyDocIds.length} documents (${retrieved.length} chunks returned): ${(t9 - t8).toFixed(2)} ms`);

  // 4. Large Document Handling
  console.log('\n[4] Large Document Handling');
  console.log(`- Largest document indexed: "${largeDoc.originalName}" (${largeDoc.pageCount} pages, ${largeDoc.chunkCount} chunks)`);
  const t10 = performance.now();
  const _largeDocRetrieval = await VectorStore.search(queryEmbedding, [largeDoc._id.toString()], {
    topK: 10,
    minScore: 0.15,
    queryText: 'few shot learning and prompt engineering',
    hybridWeight: 0.85,
    isBroadQuery: false,
    totalDocChunks: largeDoc.chunkCount,
  });
  const t11 = performance.now();
  console.log(`- Retrieval across large document (196 chunks): ${(t11 - t10).toFixed(2)} ms`);

  // 5. Memory footprint
  console.log('\n[5] Memory Footprint');
  const mem = process.memoryUsage();
  console.log(`- RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);

  await disconnectDB();
  console.log('\n--- Benchmark Completed Successfully ---');
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
