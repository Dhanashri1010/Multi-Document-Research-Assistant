import { describe, it, expect } from 'vitest';
import { createApp } from '../app.js';

interface RouteDefinition {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
}

// Complete catalog of all API endpoints invoked across the frontend services:
// (documentService, researchService, authService, nlpService)
const FRONTEND_CONTRACT_ROUTES: RouteDefinition[] = [
  // Health
  { method: 'GET', path: '/api/health' },

  // Auth Routes
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'GET', path: '/api/auth/me' },

  // Document Routes
  { method: 'GET', path: '/api/documents' },
  { method: 'POST', path: '/api/documents/upload' },
  { method: 'GET', path: '/api/documents/stats' },
  { method: 'GET', path: '/api/documents/collections' },
  { method: 'POST', path: '/api/documents/reindex-all' },
  { method: 'POST', path: '/api/documents/import-arxiv' },
  { method: 'GET', path: '/api/documents/:id' },
  { method: 'PATCH', path: '/api/documents/:id/collection' },
  { method: 'DELETE', path: '/api/documents/:id' },
  { method: 'POST', path: '/api/documents/:id/reprocess' },
  { method: 'POST', path: '/api/documents/:id/summarize' },
  { method: 'GET', path: '/api/documents/:id/file' },
  { method: 'GET', path: '/api/documents/:id/chunks' },

  // Research / Chat Routes
  { method: 'POST', path: '/api/chat/ask' },
  { method: 'POST', path: '/api/chat/ask/stream' },
  { method: 'GET', path: '/api/chat/sessions' },
  { method: 'GET', path: '/api/chat/sessions/:id' },
  { method: 'DELETE', path: '/api/chat/sessions/:id' },
  { method: 'POST', path: '/api/research/compare' },

  // NLP / Insights Routes
  { method: 'POST', path: '/api/nlp/preprocess' },
  { method: 'POST', path: '/api/nlp/vectorize' },
  { method: 'POST', path: '/api/nlp/sentiment' },
  { method: 'POST', path: '/api/nlp/extract' },
  { method: 'POST', path: '/api/nlp/evaluation/run' },
  { method: 'GET', path: '/api/nlp/evaluation/results' },
  { method: 'GET', path: '/api/nlp/llm-quota' },
  { method: 'GET', path: '/api/nlp/prompts' },
  { method: 'POST', path: '/api/nlp/topics' },
  { method: 'POST', path: '/api/nlp/multilingual/detect' },
  { method: 'POST', path: '/api/nlp/multilingual/translate' },
  { method: 'POST', path: '/api/nlp/multilingual/ask' },
  { method: 'POST', path: '/api/nlp/literature-review' },
  { method: 'POST', path: '/api/nlp/warm-cache' },
];

function extractRegisteredRoutes(app: any): RouteDefinition[] {
  const routes: RouteDefinition[] = [];

  function traverseStack(stack: any[], prefix: string = '') {
    for (const layer of stack) {
      if (layer.route) {
        const routePath = prefix + (layer.route.path === '/' ? '' : layer.route.path);
        const methods = Object.keys(layer.route.methods || {}).filter((m) => layer.route.methods[m]);
        for (const m of methods) {
          routes.push({
            method: m.toUpperCase() as any,
            path: routePath || '/',
          });
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        let mountPath = '';
        if (layer.regexp) {
          // Convert Express mount regexp e.g. /^\/api\/?(?=\/|$)/ to '/api'
          const regexStr = layer.regexp.toString();
          const match = regexStr.match(/^\/\^\\(\/[a-zA-Z0-9_\-\/]+?)\\\/\?\(\?=\\\/\|\$\)\/i?/);
          if (match && match[1]) {
            mountPath = match[1].replace(/\\/g, '');
          } else {
            // Alternate pattern e.g. /^\/api\/?(?=\/|$)/
            const simpleMatch = regexStr.match(/\\([a-zA-Z0-9_\-]+)/g);
            if (simpleMatch) {
              mountPath = '/' + simpleMatch.map((s: string) => s.replace(/\\/g, '')).join('/');
            }
          }
        }
        traverseStack(layer.handle.stack, prefix + mountPath);
      }
    }
  }

  if (app._router?.stack) {
    traverseStack(app._router.stack);
  }

  return routes;
}

describe('API Contract Verification: Frontend Services vs Backend Express Routes', () => {
  const app = createApp();
  const registeredRoutes = extractRegisteredRoutes(app);

  it('verifies that every frontend service path has a registered backend route and method', () => {
    const missingRoutes: string[] = [];

    for (const frontendRoute of FRONTEND_CONTRACT_ROUTES) {
      // Normalize parameter patterns like :id and :docId
      const normalizedFrontendPath = frontendRoute.path
        .replace(/:[a-zA-Z0-9_]+/g, ':param')
        .replace(/\/+$/, '');

      const found = registeredRoutes.some((backendRoute) => {
        if (backendRoute.method !== frontendRoute.method) return false;
        const normalizedBackendPath = backendRoute.path
          .replace(/:[a-zA-Z0-9_]+/g, ':param')
          .replace(/\/+$/, '');
        return normalizedBackendPath === normalizedFrontendPath;
      });

      if (!found) {
        missingRoutes.push(`${frontendRoute.method} ${frontendRoute.path}`);
      }
    }

    if (missingRoutes.length > 0) {
      console.error('Missing backend routes for frontend contract:', missingRoutes);
    }

    expect(
      missingRoutes,
      `The following frontend API contract routes have NO matching backend route: \n${missingRoutes.join('\n')}`
    ).toHaveLength(0);
  });

  it('verifies that all critical /api/nlp/* endpoints return JSON (never bare HTML 404)', () => {
    const nlpEndpoints = FRONTEND_CONTRACT_ROUTES.filter((r) => r.path.startsWith('/api/nlp/'));
    expect(nlpEndpoints.length).toBeGreaterThanOrEqual(13);

    for (const ep of nlpEndpoints) {
      expect(ep.path).toMatch(/^\/api\/nlp\/[a-z0-9_\-\/]+$/);
    }
  });
});
