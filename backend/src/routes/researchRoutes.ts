import { Router } from 'express';
import { ResearchController } from '../controllers/researchController.js';

const router = Router();

router.post('/compare', ResearchController.compare);

export default router;
