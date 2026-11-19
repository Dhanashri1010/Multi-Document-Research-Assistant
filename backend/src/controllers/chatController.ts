import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { RAGService } from '../services/ai/ragService.js';
import { ResearchSessionModel } from '../models/ResearchSession.js';
import { ChatMessageModel } from '../models/ChatMessage.js';
import { DocumentModel } from '../models/Document.js';

export class ChatController {
  /**
   * Helper to validate that selected documents belong to the authenticated user.
   */
  private static async validateDocumentOwnership(
    documentIds: string[],
    userId?: string
  ): Promise<boolean> {
    if (!userId) return true;
    const count = await DocumentModel.countDocuments({
      _id: { $in: documentIds },
      $or: [{ userId }, { userId: { $exists: false } }],
    });
    return count === documentIds.length;
  }

  /**
   * Ask question across selected documents using RAG.
   */
  static async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, documentIds, sessionId, targetLanguage } = req.body;
      const userId = req.user?.userId;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ success: false, error: 'Question is required.' });
        return;
      }

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ success: false, error: 'At least one document ID must be selected.' });
        return;
      }

      const isAuthorized = await ChatController.validateDocumentOwnership(documentIds, userId);
      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          error: 'Access denied: One or more selected documents do not belong to your account.',
        });
        return;
      }

      if (sessionId) {
        const session = await ResearchSessionModel.findById(sessionId);
        if (session && (!session.userId || !userId || session.userId.toString() !== userId)) {
          res.status(403).json({
            success: false,
            error: 'Access denied: You do not have permission to access this research session.',
          });
          return;
        }
      }

      const response = await RAGService.ask({
        question,
        documentIds,
        sessionId,
        userId,
        targetLanguage,
      });

      res.json({
        success: true,
        ...response,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Ask question with Server-Sent Events (SSE) streaming.
   */
  static async askStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, documentIds, sessionId, targetLanguage } = req.body;
      const userId = req.user?.userId;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ success: false, error: 'Question is required.' });
        return;
      }

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ success: false, error: 'At least one document ID must be selected.' });
        return;
      }

      const isAuthorized = await ChatController.validateDocumentOwnership(documentIds, userId);
      if (!isAuthorized) {
        res.status(403).json({
          success: false,
          error: 'Access denied: One or more selected documents do not belong to your account.',
        });
        return;
      }

      if (sessionId) {
        const session = await ResearchSessionModel.findById(sessionId);
        if (session && (!session.userId || !userId || session.userId.toString() !== userId)) {
          res.status(403).json({
            success: false,
            error: 'Access denied: You do not have permission to access this research session.',
          });
          return;
        }
      }

      // Configure SSE response headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }

      await RAGService.askStream(
        { question, documentIds, sessionId, userId, targetLanguage },
        (event) => {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      );

      res.end();
    } catch (err) {
      next(err);
    }
  }

  /**
   * List all research sessions scoped to authenticated user.
   */
  static async getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      // Strict user isolation: user sees ONLY their own sessions. Unowned legacy sessions are blocked.
      const filter: any = userId ? { userId: new mongoose.Types.ObjectId(userId) } : { _id: null };
      const sessions = await ResearchSessionModel.find(filter).sort({ updatedAt: -1 });
      res.json({ success: true, sessions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get messages and session details for a given session with strict ownership validation.
   */
  static async getSessionMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const session = await ResearchSessionModel.findById(sessionId);
      if (!session) {
        res.status(404).json({ success: false, error: 'Research session not found.' });
        return;
      }

      const userId = req.user?.userId;
      // Strict ownership check: session must be owned by the authenticated user
      if (!session.userId || !userId || session.userId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You do not have permission to access this research session.',
        });
        return;
      }

      const messages = await ChatMessageModel.find({ sessionId }).sort({ createdAt: 1 });
      res.json({ success: true, session, messages });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Clear / delete a research session and its messages with strict ownership check.
   */
  static async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const session = await ResearchSessionModel.findById(sessionId);
      if (!session) {
        res.status(404).json({ success: false, error: 'Research session not found or already deleted.' });
        return;
      }

      const userId = req.user?.userId;
      // Strict ownership check: session must be owned by the authenticated user
      if (!session.userId || !userId || session.userId.toString() !== userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You do not have permission to delete this research session.',
        });
        return;
      }

      await Promise.all([
        ChatMessageModel.deleteMany({ sessionId }),
        ResearchSessionModel.findByIdAndDelete(sessionId),
      ]);
      res.json({ success: true, message: 'Research session cleared.' });
    } catch (err) {
      next(err);
    }
  }
}
