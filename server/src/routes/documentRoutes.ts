import express from 'express';
import { getDocuments, createDocument, getDocumentById, updateDocument } from '../controllers/documentController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken); // Protect all routes

router.get('/', getDocuments);
router.post('/', createDocument);
router.get('/:id', getDocumentById);
router.put('/:id', updateDocument);
router.patch('/:id', updateDocument);

export default router;
