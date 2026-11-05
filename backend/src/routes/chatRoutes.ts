import { Router } from 'express';
import { ChatController } from '../controllers/chatController.js';

const router = Router();

router.post('/ask', ChatController.ask);
router.post('/ask/stream', ChatController.askStream);
router.get('/sessions', ChatController.getSessions);
router.get('/sessions/:sessionId', ChatController.getSessionMessages);
router.delete('/sessions/:sessionId', ChatController.deleteSession);

export default router;
