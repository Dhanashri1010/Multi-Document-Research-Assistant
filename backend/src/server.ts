import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';
import { getEmbeddingProvider } from './services/ai/embeddingService.js';
import { DocumentModel } from './models/Document.js';
import { IngestionService } from './services/documents/ingestionService.js';

async function startServer() {
  await connectDB();

  // Auto-recover and resume any interrupted document ingestion from previous crashes or restarts
  try {
    const interruptedDocs = await DocumentModel.find({ status: 'processing' });
    if (interruptedDocs.length > 0) {
      console.log(`[Server] Found ${interruptedDocs.length} interrupted document(s). Auto-resuming ingestion queue...`);
      for (const doc of interruptedDocs) {
        doc.status = 'uploaded';
        doc.errorDetails = undefined;
        await doc.save();
        IngestionService.queueDocument(doc._id).catch((err) => {
          console.error(`[Server] Auto-resume failed for document ${doc._id}:`, err);
        });
      }
    }
  } catch (cleanErr) {
    console.warn('[Server] Failed to recover interrupted processing documents:', cleanErr);
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    const activeEmbedder = getEmbeddingProvider();
    console.log(`=======================================================`);
    console.log(`  Multi-Document Research Assistant Backend is running `);
    console.log(`  Local: http://localhost:${config.port}`);
    console.log(`  Health: http://localhost:${config.port}/api/health`);
    console.log(`  Configured Embedding: ${config.embeddingProvider} (${config.embeddingModel})`);
    console.log(`  Active Embedding Model: ${activeEmbedder.getModelName()} (${activeEmbedder.getDimension()}-dim)`);
    console.log(`  LLM: ${config.llmProvider} (${config.llmModel})`);
    console.log(`  Vector Search: ${config.vectorSearchProvider}`);
    console.log(`=======================================================`);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      console.log('[Server] MongoDB disconnected. Process exiting.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
