import { Router } from 'express';
import { z } from 'zod';
import { DocumentController } from '../controllers/documentController.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { validateParams } from '../middleware/validateRequest.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Document ID must be a valid 24-character hexadecimal MongoDB ObjectId'),
});

router.post('/upload', uploadMiddleware.array('files', 10), DocumentController.upload);
router.post('/reindex-all', DocumentController.reindexAll);
router.get('/', DocumentController.list);
router.get('/stats', DocumentController.getStats);
router.get('/:id', validateParams(idParamSchema), DocumentController.getById);
router.get('/:id/status', validateParams(idParamSchema), DocumentController.getStatus);
router.get('/:id/file', validateParams(idParamSchema), DocumentController.getFile);
router.post('/:id/reprocess', validateParams(idParamSchema), DocumentController.reprocess);
router.delete('/:id', validateParams(idParamSchema), DocumentController.delete);
router.post('/:id/summarize', validateParams(idParamSchema), DocumentController.summarize);

export default router;
