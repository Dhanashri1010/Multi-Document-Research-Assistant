import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[ErrorHandler] Error caught:', err);

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        error: 'File size exceeds maximum allowed limit.',
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
    return;
  }

  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'An unexpected internal server error occurred.';

  res.status(statusCode).json({
    success: false,
    error: message,
  });
}
