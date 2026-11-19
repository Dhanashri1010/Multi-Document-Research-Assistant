import { Router } from 'express';
import documentRoutes from './documentRoutes.js';
import chatRoutes from './chatRoutes.js';
import researchRoutes from './researchRoutes.js';
import authRoutes from './authRoutes.js';
import nlpRoutes from './nlpRoutes.js';
import { healthRouter } from './healthRoutes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/research', researchRoutes);
apiRouter.use('/nlp', nlpRoutes);

export default apiRouter;
