import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): express.Application {
  const app = express();

  // CORS Configuration
  app.use(
    cors({
      origin: [config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Root handler: redirect browser visitors to the frontend UI
  app.get('/', (req, res) => {
    if (req.accepts('html')) {
      res.redirect('http://localhost:5173');
      return;
    }
    res.json({
      service: 'Multi-Document Research Assistant API',
      status: 'running',
      frontendUrl: 'http://localhost:5173',
      healthUrl: '/api/health',
    });
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Multi-Document Research Assistant API',
      embeddingProvider: config.embeddingProvider,
      llmProvider: config.llmProvider,
      vectorProvider: config.vectorSearchProvider,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API Routes
  app.use('/api', apiRouter);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
