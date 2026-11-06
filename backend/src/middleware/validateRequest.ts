import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'The request payload is invalid.',
          issues: error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      next(error);
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Invalid Parameters',
          message: 'The request URL parameters are invalid.',
          issues: error.issues.map((i) => ({
            param: i.path.join('.'),
            message: i.message,
          })),
        });
      }
      next(error);
    }
  };
}
