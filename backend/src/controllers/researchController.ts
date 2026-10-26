import { Request, Response, NextFunction } from 'express';
import { ComparisonService } from '../services/ai/comparisonService.js';

export class ResearchController {
  /**
   * Compares 2 or more research documents across 8 dimensions.
   */
  static async compare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentIds, focusTopic } = req.body;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
        res.status(400).json({
          success: false,
          error: 'At least two document IDs are required for cross-document comparison.',
        });
        return;
      }

      const comparisonResult = await ComparisonService.compareDocuments(
        documentIds,
        focusTopic
      );

      res.json({
        success: true,
        ...comparisonResult,
      });
    } catch (err) {
      next(err);
    }
  }
}
