import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import multer from 'multer';
import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error({
    err,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  }, 'Unhandled request error caught in centralized errorHandler');

  // Zod Validation Error
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'The submitted request data is invalid.',
      issues: err.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  // Multer Upload Errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File Too Large',
        message: `Maximum allowed file size is ${config.maxFileSizeMB} MB.`,
      });
    }
    return res.status(400).json({
      error: 'Upload Error',
      message: err.message,
    });
  }

  // Mongoose Cast Error (Invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: 'Invalid Identifier',
      message: `Invalid format for resource ID: ${err.value}`,
    });
  }

  // Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: 'Model Validation Error',
      message: err.message,
    });
  }

  // Generic internal server error
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected internal error occurred.',
    ...(config.nodeEnv !== 'production' ? { stack: err.stack } : {}),
  });
}
