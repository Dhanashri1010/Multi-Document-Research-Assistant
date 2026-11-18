import { Request, Response, NextFunction } from 'express';
import { ComparisonService } from '../services/ai/comparisonService.js';
import { DocumentModel } from '../models/Document.js';

export class ResearchController {
  /**
   * Compares 2 or more research documents across 10 dimensions with user data isolation.
   */
  static async compare(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { documentIds, focusTopic } = req.body;
      const userId = req.user?.userId;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length < 2) {
        res.status(400).json({
          success: false,
          error: 'At least two document IDs are required for cross-document comparison.',
        });
        return;
      }

      if (userId) {
        const count = await DocumentModel.countDocuments({
          _id: { $in: documentIds },
          $or: [{ userId }, { userId: { $exists: false } }],
        });

        if (count !== documentIds.length) {
          res.status(403).json({
            success: false,
            error: 'Access denied: One or more selected documents do not belong to your account.',
          });
          return;
        }
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
