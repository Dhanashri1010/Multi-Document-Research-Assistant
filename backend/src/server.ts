import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config } from './config/env.js';

import { DocumentModel } from './models/Document.js';

async function startServer() {
  await connectDB();

  // Reset any zombie ingestion states from previous crashes or restarts
  try {
    const updated = await DocumentModel.updateMany(
      { status: 'processing' },
      { status: 'failed', errorDetails: 'Server restarted while processing. Please retry ingestion.' }
    );
    if (updated.modifiedCount > 0) {
      console.log(`[Server] Reset ${updated.modifiedCount} zombie processing document(s) to failed.`);
    }
  } catch (cleanErr) {
    console.warn('[Server] Failed to clean up zombie processing documents:', cleanErr);
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`  Multi-Document Research Assistant Backend is running `);
    console.log(`  Local: http://localhost:${config.port}`);
    console.log(`  Health: http://localhost:${config.port}/api/health`);
    console.log(`  Embedding: ${config.embeddingProvider} (${config.embeddingModel})`);
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
