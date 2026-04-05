import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/authMiddleware';

const prisma = new PrismaClient();

export const getComplianceItems = async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.complianceItem.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching compliance items', error });
  }
};

export const createComplianceItem = async (req: AuthRequest, res: Response) => {
  try {
    const { title, area, description, status, riskLevel, lastAssessment, nextReview, observations } = req.body;
    
    const item = await prisma.complianceItem.create({
      data: {
        title,
        area,
        description,
        status,
        riskLevel,
        lastAssessment: lastAssessment ? new Date(lastAssessment) : undefined,
        nextReview: nextReview ? new Date(nextReview) : undefined,
        observations
      }
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error creating compliance item', error });
  }
};
