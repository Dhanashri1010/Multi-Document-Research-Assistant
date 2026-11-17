import { Router } from 'express';
import { z } from 'zod';
import { ResearchController } from '../controllers/researchController.js';
import { validateBody } from '../middleware/validateRequest.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

const compareBodySchema = z.object({
  documentIds: z
    .array(z.string().min(1))
    .min(2, 'Comparison requires at least 2 documents to compare against each other.'),
  focusArea: z.string().optional(),
});

router.post('/compare', aiRateLimiter, validateBody(compareBodySchema), ResearchController.compare);

export default router;
