import path from 'path';
import dotenv from 'dotenv';

// Load environment variables before other imports
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import { config } from '../src/config/env.js';
import { DocumentModel } from '../src/models/Document.js';
import { IngestionService } from '../src/services/documents/ingestionService.js';
import { invalidateVectorCache } from '../src/services/ai/vectorStore.js';
import { getEmbeddingProvider } from '../src/services/ai/embeddingService.js';

async function main() {
  console.log('====================================================');
  console.log('  Multi-Document Research Assistant - Re-Ingestion  ');
  console.log('====================================================');

  const mongoUri = config.mongoUri || 'mongodb://127.0.0.1:27017/multi_doc_research';
  console.log(`Connecting to MongoDB at: ${mongoUri.replace(/:([^:@]{4})[^:@]*@/, ':****@')}`);
  await mongoose.connect(mongoUri);

  const provider = getEmbeddingProvider();
  console.log(`Active Embedding Provider: ${provider.getModelName()} (dim: ${provider.getDimension()})`);

  // Target specific IDs if passed as CLI arguments, otherwise re-ingest all docs
  const targetIds = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const query = targetIds.length > 0
    ? { _id: { $in: targetIds.map((id) => new mongoose.Types.ObjectId(id)) } }
    : {};

  const docs = await DocumentModel.find(query).sort({ createdAt: 1 });
  console.log(`Found ${docs.length} document(s) to re-ingest.\n`);

  if (docs.length === 0) {
    console.log('No documents found matching criteria. Exiting.');
    await mongoose.disconnect();
    return;
  }

  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    console.log(`[${i + 1}/${docs.length}] Re-processing: "${doc.originalName}" (${doc._id})`);

    try {
      await IngestionService.processDocument(doc._id);
      const updated = await DocumentModel.findById(doc._id);

      if (updated?.status === 'ready') {
        console.log(`  ✓ Success: ${updated.chunkCount} chunks, ${updated.pageCount} pages, model: ${updated.embeddingModel}`);
        succeeded++;
      } else {
        console.error(`  ✗ Failed: ${updated?.errorDetails || 'Unknown error'}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`  ✗ Error re-ingesting document: ${err.message}`);
      failed++;
    }
  }

  invalidateVectorCache();
  console.log('\n====================================================');
  console.log(`Re-ingestion complete. Succeeded: ${succeeded}, Failed: ${failed}, Total: ${docs.length}`);
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal re-ingestion error:', err);
  process.exit(1);
});
