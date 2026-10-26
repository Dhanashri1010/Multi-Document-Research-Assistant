import { Request, Response, NextFunction } from 'express';
import { RAGService } from '../services/ai/ragService.js';
import { ResearchSessionModel } from '../models/ResearchSession.js';
import { ChatMessageModel } from '../models/ChatMessage.js';

export class ChatController {
  /**
   * Ask question across selected documents using RAG.
   */
  static async ask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, documentIds, sessionId } = req.body;

      if (!question || typeof question !== 'string') {
        res.status(400).json({ success: false, error: 'Question is required.' });
        return;
      }

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        res.status(400).json({ success: false, error: 'At least one document ID must be selected.' });
        return;
      }

      const response = await RAGService.ask({
        question,
        documentIds,
        sessionId,
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
   * List all research sessions.
   */
  static async getSessions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await ResearchSessionModel.find().sort({ updatedAt: -1 });
      res.json({ success: true, sessions });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get messages for a given session.
   */
  static async getSessionMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
      const messages = await ChatMessageModel.find({ sessionId }).sort({ createdAt: 1 });
      res.json({ success: true, messages });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Clear / delete a research session and its messages.
   */
  static async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.params.sessionId as string;
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
