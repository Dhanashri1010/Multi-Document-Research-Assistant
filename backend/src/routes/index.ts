import { Router } from 'express';
import documentRoutes from './documentRoutes.js';
import chatRoutes from './chatRoutes.js';
import researchRoutes from './researchRoutes.js';

const apiRouter = Router();

apiRouter.use('/documents', documentRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/research', researchRoutes);

export default apiRouter;
