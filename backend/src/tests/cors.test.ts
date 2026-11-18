import { describe, it, expect } from 'vitest';
import cors from 'cors';
import {
  corsOptions,
  isOriginAllowed,
  normalizeOrigin,
  parseOrigins,
  getAllowedOrigins,
  DEFAULT_PRODUCTION_ORIGINS,
  LOCAL_DEV_ORIGINS,
  VERCEL_PREVIEW_REGEX,
} from '../config/cors.js';

interface SimulatedResponse {
  status: number;
  headers: Record<string, string>;
  ended: boolean;
  err?: any;
}

/**
 * Simulates invoking Express CORS middleware directly on request & response objects
 * without requiring live TCP socket binding (which is restricted in sandbox environments).
 */
function runCors(
  reqOptions: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  },
  options = corsOptions
): Promise<SimulatedResponse> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    let status = 200;
    let ended = false;

    // Normalize incoming headers to lowercase keys
    const normalizedHeaders: Record<string, string> = {};
    if (reqOptions.headers) {
      for (const [k, v] of Object.entries(reqOptions.headers)) {
        normalizedHeaders[k.toLowerCase()] = v;
      }
    }

    const req: any = {
      method: reqOptions.method || 'GET',
      url: reqOptions.url || '/api/health',
      headers: normalizedHeaders,
    };

    const res: any = {
      statusCode: 200,
      setHeader: (k: string, v: any) => {
        headers[k.toLowerCase()] = String(v);
      },
      getHeader: (k: string) => headers[k.toLowerCase()],
      status: (code: number) => {
        status = code;
        res.statusCode = code;
        return res;
      },
      end: () => {
        ended = true;
        resolve({ status: res.statusCode || status, headers, ended });
      },
    };

    const middleware = cors(options);
    middleware(req, res, (err?: any) => {
      resolve({ status: res.statusCode || status, headers, ended, err });
    });
  });
}

describe('CORS Configuration & Middleware Verification', () => {
  describe('1. Origin Normalization and Parsing Helpers', () => {
    it('normalizes origins by trimming spaces and removing trailing slashes', () => {
      expect(normalizeOrigin('  https://example.com/  ')).toBe('https://example.com');
      expect(normalizeOrigin('http://localhost:5173///')).toBe('http://localhost:5173');
      expect(normalizeOrigin('https://multi-document-research-assistant-two.vercel.app/')).toBe(
        'https://multi-document-research-assistant-two.vercel.app'
      );
    });

    it('parses comma, semicolon, and space separated origin strings safely', () => {
      const raw = 'https://site1.com, https://site2.com; https://site3.com   https://site4.com';
      const parsed = parseOrigins(raw);
      expect(parsed).toEqual([
        'https://site1.com',
        'https://site2.com',
        'https://site3.com',
        'https://site4.com',
      ]);
    });

    it('handles empty or undefined origin strings gracefully', () => {
      expect(parseOrigins(undefined)).toEqual([]);
      expect(parseOrigins('')).toEqual([]);
      expect(parseOrigins('   ')).toEqual([]);
    });

    it('matches Vercel project deployment subdomains with tightened VERCEL_PREVIEW_REGEX', () => {
      // Deployment specific preview domain for user team 'research-assistant1'
      expect(
        VERCEL_PREVIEW_REGEX.test(
          'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app'
        )
      ).toBe(true);

      // Generic branch preview subdomains for this specific team repo
      expect(
        VERCEL_PREVIEW_REGEX.test(
          'https://multi-document-research-assistant-git-main-research-assistant1.vercel.app'
        )
      ).toBe(true);
      expect(
        VERCEL_PREVIEW_REGEX.test(
          'https://multi-document-research-assistant-research-assistant1.vercel.app'
        )
      ).toBe(true);

      // STRICTLY REJECTS unrelated Vercel projects or other users' deployments
      expect(
        VERCEL_PREVIEW_REGEX.test(
          'https://multi-document-research-assistant-otheruser.vercel.app'
        )
      ).toBe(false);
      expect(
        VERCEL_PREVIEW_REGEX.test(
          'https://multi-document-research-assistant-malicious-team.vercel.app'
        )
      ).toBe(false);
      expect(VERCEL_PREVIEW_REGEX.test('https://other-unrelated-project.vercel.app')).toBe(false);
      expect(
        VERCEL_PREVIEW_REGEX.test('https://multi-document-research-assistant-fake.com')
      ).toBe(false);
      expect(
        VERCEL_PREVIEW_REGEX.test(
          'https://multi-document-research-assistant-two.vercel.app.attacker.com'
        )
      ).toBe(false);
    });

    it('confirms default allowed list contains required domains', () => {
      const allowed = getAllowedOrigins();
      expect(allowed.has('https://multi-document-research-assistant-two.vercel.app')).toBe(true);
      expect(
        allowed.has(
          'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app'
        )
      ).toBe(true);
      expect(allowed.has('https://multi-document-research-assistant.vercel.app')).toBe(true);
      expect(allowed.has('http://localhost:5173')).toBe(true);
      expect(allowed.has('http://127.0.0.1:5173')).toBe(true);
    });
  });

  describe('2. Direct Origin Validation with isOriginAllowed', () => {
    it('allows production frontend: https://multi-document-research-assistant-two.vercel.app', () => {
      expect(isOriginAllowed('https://multi-document-research-assistant-two.vercel.app')).toBe(true);
      expect(isOriginAllowed('https://multi-document-research-assistant-two.vercel.app/')).toBe(true);
    });

    it('allows preview frontend: https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app', () => {
      expect(
        isOriginAllowed(
          'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app'
        )
      ).toBe(true);
    });

    it('allows local development origins (localhost & 127.0.0.1 on ports 5173, 5174, 3000)', () => {
      expect(isOriginAllowed('http://localhost:5173')).toBe(true);
      expect(isOriginAllowed('http://127.0.0.1:5173')).toBe(true);
      expect(isOriginAllowed('http://localhost:5174')).toBe(true);
      expect(isOriginAllowed('http://localhost:3000')).toBe(true);
    });

    it('allows server-to-server and non-browser requests where Origin is undefined', () => {
      expect(isOriginAllowed(undefined)).toBe(true);
    });

    it('strictly denies unauthorized origins without wildcard fallback', () => {
      expect(isOriginAllowed('https://evil-hacker.com')).toBe(false);
      expect(isOriginAllowed('https://google.com')).toBe(false);
      expect(isOriginAllowed('http://malicious-local.com:5173')).toBe(false);
    });
  });

  describe('3. CORS Middleware HTTP Header Tests (Standard Requests)', () => {
    it('sets Access-Control-Allow-Origin & Credentials for production frontend', async () => {
      const res = await runCors({
        method: 'GET',
        headers: {
          origin: 'https://multi-document-research-assistant-two.vercel.app',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBe(
        'https://multi-document-research-assistant-two.vercel.app'
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
      expect(res.err).toBeUndefined();
    });

    it('sets Access-Control-Allow-Origin & Credentials for preview frontend', async () => {
      const res = await runCors({
        method: 'GET',
        headers: {
          origin:
            'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBe(
        'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app'
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('sets Access-Control-Allow-Origin for local dev http://localhost:5173', async () => {
      const res = await runCors({
        method: 'GET',
        headers: {
          origin: 'http://localhost:5173',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does NOT set Access-Control-Allow-Origin header for disallowed external origin', async () => {
      const res = await runCors({
        method: 'GET',
        headers: {
          origin: 'https://attacker-domain.com',
        },
      });

      // Browser blocks reading the response if access-control-allow-origin is missing
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.err).toBeFalsy();
    });
  });

  describe('4. Preflight OPTIONS Requests Handling', () => {
    it('responds correctly to OPTIONS preflight with Authorization header request', async () => {
      const res = await runCors({
        method: 'OPTIONS',
        url: '/api/documents',
        headers: {
          origin: 'https://multi-document-research-assistant-two.vercel.app',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization, content-type',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe(
        'https://multi-document-research-assistant-two.vercel.app'
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');

      // Verify allowed methods include standard CRUD operations and PATCH
      const methods = res.headers['access-control-allow-methods'];
      expect(methods).toBeDefined();
      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('PUT');
      expect(methods).toContain('PATCH');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('OPTIONS');

      // Verify allowed headers
      const headers = res.headers['access-control-allow-headers'];
      expect(headers).toBeDefined();
      expect(headers?.toLowerCase()).toContain('authorization');
      expect(headers?.toLowerCase()).toContain('content-type');

      // Verify preflight caching
      expect(res.headers['access-control-max-age']).toBe('86400');
    });

    it('handles OPTIONS preflight for auth endpoints (/api/auth/register and /api/auth/login)', async () => {
      const resRegister = await runCors({
        method: 'OPTIONS',
        url: '/api/auth/register',
        headers: {
          origin:
            'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });

      expect(resRegister.status).toBe(200);
      expect(resRegister.headers['access-control-allow-origin']).toBe(
        'https://multi-document-research-assistant-crtov0rae-research-assistant1.vercel.app'
      );

      const resLogin = await runCors({
        method: 'OPTIONS',
        url: '/api/auth/login',
        headers: {
          origin: 'https://multi-document-research-assistant-two.vercel.app',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      });

      expect(resLogin.status).toBe(200);
      expect(resLogin.headers['access-control-allow-origin']).toBe(
        'https://multi-document-research-assistant-two.vercel.app'
      );
    });

    it('does NOT provide preflight approval for unauthorized origins', async () => {
      const res = await runCors({
        method: 'OPTIONS',
        url: '/api/documents',
        headers: {
          origin: 'https://malicious-site.com',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'authorization',
        },
      });

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
