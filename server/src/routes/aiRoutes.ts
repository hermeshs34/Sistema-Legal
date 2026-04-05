import express from 'express';
import { analyzeDocument } from '../controllers/aiController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.post('/analyze', analyzeDocument);

export default router;
