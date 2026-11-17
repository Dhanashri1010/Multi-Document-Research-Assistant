import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Strips internal system file paths, credentials, and API keys from error messages
 * before sending to client interfaces.
 */
export function sanitizeErrorMessage(raw: string): string {
  if (!raw || typeof raw !== 'string') return 'An unexpected internal error occurred.';
  return raw
    // Strip Windows drive paths (e.g. C:\Users\..., E:\...) - stop at whitespace, quotes, or punctuation
    .replace(/[a-zA-Z]:\\(?:[^\s"'<>|:;,\t\r\n]+\\)*[^\s"'<>|:;,\t\r\n]*/g, '[internal path]')
    // Strip POSIX paths (e.g. /home/..., /var/..., /usr/...)
    .replace(/(?:\/[\w.-]+){2,}/g, '[internal path]')
    // Strip Google / Gemini / standard API keys (e.g. AIza...)
    .replace(/AIza[0-9A-Za-z-_]{35}/g, '[redacted API key]')
    // Strip generic bearer tokens, credentials, and JWT fragments
    .replace(/Bearer(?:\s+token)?\s+[0-9a-zA-Z-_.]+/gi, '[redacted credential]')
    .replace(/\beyJ[a-zA-Z0-9_-]{8,}\b/g, '[redacted credential]')
    .replace(/(?:password|secret|token)[:=]\s*["']?[^"'\s,]+/gi, '[redacted credential]');
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Always log full, unredacted error details server-side for diagnostics
  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    },
    'Unhandled request error caught in centralized errorHandler'
  );

  // Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'The submitted request data is invalid.',
      issues: err.issues.map((i) => ({
        field: i.path.join('.'),
        message: sanitizeErrorMessage(i.message),
      })),
    });
  }

  // Multer Upload Errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File Too Large',
        message: `Maximum allowed file size is ${config.maxFileSizeMB} MB.`,
      });
    }
    return res.status(400).json({
      success: false,
      error: 'Upload Error',
      message: sanitizeErrorMessage(err.message),
    });
  }

  // Mongoose Cast Error (Invalid ObjectId format)
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Identifier',
      message: `Invalid format for resource ID.`,
    });
  }

  // Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      error: 'Model Validation Error',
      message: sanitizeErrorMessage(err.message),
    });
  }

  // Generic internal server error: NEVER expose raw stacks or file paths to client
  const statusCode =
    typeof err.status === 'number'
      ? err.status
      : typeof err.statusCode === 'number'
        ? err.statusCode
        : 500;

  const rawMsg = err.message || 'An unexpected internal error occurred.';
  const safeMsg = sanitizeErrorMessage(rawMsg);

  return res.status(statusCode).json({
    success: false,
    error: err.name && err.name !== 'Error' ? err.name : 'Internal Server Error',
    message: safeMsg,
  });
}
