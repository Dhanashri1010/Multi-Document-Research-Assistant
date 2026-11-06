import { Router } from 'express';
import documentRoutes from './documentRoutes.js';
import chatRoutes from './chatRoutes.js';
import researchRoutes from './researchRoutes.js';
import { healthRouter } from './healthRoutes.js';

const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/research', researchRoutes);

export default apiRouter;
