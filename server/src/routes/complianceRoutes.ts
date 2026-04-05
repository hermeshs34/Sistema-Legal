import express from 'express';
import { getComplianceItems, createComplianceItem } from '../controllers/complianceController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getComplianceItems);
router.post('/', createComplianceItem);

export default router;
