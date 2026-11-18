import { Request, Response, NextFunction } from 'express';
import { verifyToken, AuthUserPayload } from '../utils/jwt.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Strict authentication middleware: requires a valid JWT in the Authorization header.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Please log in to access this resource.',
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token.',
    });
  }
}

/**
 * Optional authentication middleware: attaches user if a valid token is present,
 * but allows the request to continue if no token was provided.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = payload;
    } catch {
      // Ignore token validation failure in optional mode
    }
  }
  next();
}
