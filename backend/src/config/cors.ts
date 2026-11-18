import cors from 'cors';
import { config } from './env.js';

// Explicitly whitelisted production domains for the Multi-Document Research Assistant
export const DEFAULT_PRODUCTION_ORIGINS = [
  'https://multi-document-research-assistant-two.vercel.app',
  'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app',
  'https://multi-document-research-assistant.vercel.app',
];

// Local development origins
export const LOCAL_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Regex matching ONLY preview deployments belonging to this specific user/team scope on Vercel
// Format: https://multi-document-research-assistant(-<deployment-or-branch>)?-research-assistant1.vercel.app
export const VERCEL_PREVIEW_REGEX =
  /^https:\/\/multi-document-research-assistant(-[a-z0-9-]+)?-research-assistant1\.vercel\.app$/i;

/**
 * Normalizes a URL string by trimming whitespace and trailing slashes.
 */
export function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Parses origins from an environment string that may contain comma, semicolon, or space-separated URLs.
 */
export function parseOrigins(envVal?: string): string[] {
  if (!envVal || typeof envVal !== 'string') return [];
  return envVal
    .split(/[,;\s]+/)
    .map((s) => normalizeOrigin(s))
    .filter((s) => s.length > 0 && (s.startsWith('http://') || s.startsWith('https://')));
}

/**
 * Compiles the full set of allowed origins from defaults, environment variables, and local dev URLs.
 */
export function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // 1. Production defaults
  DEFAULT_PRODUCTION_ORIGINS.forEach((o) => origins.add(normalizeOrigin(o)));

  // 2. Configured FRONTEND_URL and CORS_ALLOWED_ORIGINS
  parseOrigins(config.frontendUrl).forEach((o) => origins.add(o));
  if (config.corsAllowedOrigins) {
    parseOrigins(config.corsAllowedOrigins).forEach((o) => origins.add(o));
  }

  // 3. Local development origins
  LOCAL_DEV_ORIGINS.forEach((o) => origins.add(normalizeOrigin(o)));

  return origins;
}

/**
 * Validates whether an incoming request Origin is allowed under CORS policy.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Allow non-browser requests (curl, server-to-server, health checks)
    return true;
  }

  const normalized = normalizeOrigin(origin);
  const allowedSet = getAllowedOrigins();

  if (allowedSet.has(normalized)) {
    return true;
  }

  if (VERCEL_PREVIEW_REGEX.test(normalized)) {
    return true;
  }

  return false;
}

export const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    if (isOriginAllowed(requestOrigin)) {
      callback(null, true);
    } else {
      // Disallow origin cleanly without crashing the server
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Content-Disposition'],
  optionsSuccessStatus: 200,
  maxAge: 86400, // Cache preflight response for 24 hours
};

