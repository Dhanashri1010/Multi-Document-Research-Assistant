import { Router } from 'express';
import { z } from 'zod';
import { DocumentController } from '../controllers/documentController.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { validateParams, validateBody } from '../middleware/validateRequest.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Document ID must be a valid 24-character hexadecimal MongoDB ObjectId'),
});

const collectionBodySchema = z.object({
  collectionName: z.string().trim().max(100, 'Collection name cannot exceed 100 characters'),
});

const arxivBodySchema = z.object({
  url: z.string().trim().min(4, 'Please provide an arXiv URL or ID'),
  collectionName: z.string().trim().optional(),
});

router.post('/upload', uploadMiddleware.array('files', 10), DocumentController.upload);
router.post('/import-arxiv', validateBody(arxivBodySchema), DocumentController.importArxiv);
router.post('/reindex-all', DocumentController.reindexAll);
router.get('/', DocumentController.list);
router.get('/stats', DocumentController.getStats);
router.get('/collections', DocumentController.listCollections);
router.get('/:id', validateParams(idParamSchema), DocumentController.getById);
router.get('/:id/status', validateParams(idParamSchema), DocumentController.getStatus);
router.get('/:id/file', validateParams(idParamSchema), DocumentController.getFile);
router.patch('/:id/collection', validateParams(idParamSchema), validateBody(collectionBodySchema), DocumentController.updateCollection);
router.post('/:id/reprocess', validateParams(idParamSchema), DocumentController.reprocess);
router.delete('/:id', validateParams(idParamSchema), DocumentController.delete);
router.post('/:id/summarize', validateParams(idParamSchema), DocumentController.summarize);

export default router;
