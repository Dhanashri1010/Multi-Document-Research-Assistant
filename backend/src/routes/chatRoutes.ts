import { Router } from 'express';
import { z } from 'zod';
import { ChatController } from '../controllers/chatController.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';

const router = Router();

const askBodySchema = z.object({
  question: z.string().trim().min(1, 'Question cannot be empty.'),
  documentIds: z.array(z.string().min(1)).min(1, 'Please select at least one document to research.'),
  sessionId: z.string().optional(),
});

const sessionParamSchema = z.object({
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Session ID must be a valid 24-character hexadecimal MongoDB ObjectId'),
});

router.post('/ask', validateBody(askBodySchema), ChatController.ask);
router.post('/ask/stream', validateBody(askBodySchema), ChatController.askStream);
router.get('/sessions', ChatController.getSessions);
router.get('/sessions/:sessionId', validateParams(sessionParamSchema), ChatController.getSessionMessages);
router.delete('/sessions/:sessionId', validateParams(sessionParamSchema), ChatController.deleteSession);

export default router;
