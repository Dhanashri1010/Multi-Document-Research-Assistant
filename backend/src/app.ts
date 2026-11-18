import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import apiRouter from './routes/index.js';
import { healthRouter } from './routes/healthRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): express.Application {
  const app = express();

  // Enable proxy trust for reverse proxies (Render, Vercel, Cloudflare)
  app.set('trust proxy', 1);

  // CORS Configuration
  app.use(
    cors({
      origin: [
        config.frontendUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
      ],
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
      res.redirect(config.frontendUrl);
      return;
    }
    res.json({
      service: 'Multi-Document Research Assistant API',
      status: 'running',
      frontendUrl: config.frontendUrl,
      healthUrl: '/api/health',
    });
  });

  // Health check endpoints (both /health and /api/health)
  app.use('/health', healthRouter);
  app.use('/api/health', healthRouter);

  // Mount API Routes
  app.use('/api', apiRouter);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
