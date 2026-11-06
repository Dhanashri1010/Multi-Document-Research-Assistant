import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { DocumentModel } from '../models/Document.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbStateMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbState = mongoose.connection.readyState;
  const isDbHealthy = dbState === 1;

  let docCount = 0;
  let readyDocCount = 0;
  try {
    if (isDbHealthy) {
      docCount = await DocumentModel.countDocuments();
      readyDocCount = await DocumentModel.countDocuments({ status: 'ready' });
    }
  } catch (_err) {
    // Graceful handling if DB query fails during state change
  }

  const mem = process.memoryUsage();
  const memoryMB = {
    rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
  };

  const isHealthy = isDbHealthy;
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: {
      status: dbStateMap[dbState] || 'unknown',
      connected: isDbHealthy,
      totalDocuments: docCount,
      readyDocuments: readyDocCount,
    },
    system: {
      nodeEnv: config.nodeEnv,
      memoryMB,
      llmProvider: config.llmProvider,
      llmModel: config.llmModel,
      embeddingProvider: config.embeddingProvider,
      embeddingModel: config.embeddingModel,
      vectorProvider: config.vectorSearchProvider,
    },
  });
});
