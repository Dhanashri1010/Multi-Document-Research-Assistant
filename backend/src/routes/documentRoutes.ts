import { Router } from 'express';
import { DocumentController } from '../controllers/documentController.js';
import { uploadMiddleware } from '../middleware/upload.js';

const router = Router();

router.post('/upload', uploadMiddleware.array('files', 10), DocumentController.upload);
router.post('/reindex-all', DocumentController.reindexAll);
router.get('/', DocumentController.list);
router.get('/stats', DocumentController.getStats);
router.get('/:id', DocumentController.getById);
router.get('/:id/status', DocumentController.getStatus);
router.post('/:id/reprocess', DocumentController.reprocess);
router.delete('/:id', DocumentController.delete);
router.post('/:id/summarize', DocumentController.summarize);

export default router;
