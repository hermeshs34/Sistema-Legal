import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';

// Datos mock temporales para desarrollo
const mockDocuments = [
  {
    id: '1',
    title: 'Política de Privacidad',
    description: 'Política de privacidad actualizada para cumplir con GDPR',
    type: 'policy',
    status: 'active',
    riskLevel: 'medium',
    regulatoryBody: 'GDPR',
    expirationDate: '2025-12-31',
    jurisdiction: 'UE',
    linkedEntity: 'Todos los departamentos',
    tags: ['privacidad', 'gdpr', 'legal'],
    assignedTo: { name: 'Ana García', email: 'ana@empresa.com' },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2', 
    title: 'Contrato de Servicios',
    description: 'Contrato estándar de prestación de servicios',
    type: 'contract',
    status: 'draft',
    riskLevel: 'low',
    regulatoryBody: 'Ley de Contratos',
    expirationDate: '2026-06-30',
    jurisdiction: 'España',
    linkedEntity: 'Departamento Legal',
    tags: ['contrato', 'servicios', 'legal'],
    assignedTo: { name: 'Carlos López', email: 'carlos@empresa.com' },
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    res.json(mockDocuments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching documents', error });
  }
};

export const createDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, type, status, riskLevel, metadata } = req.body;
    
    const newDocument = {
      id: (mockDocuments.length + 1).toString(),
      title,
      description,
      type,
      status,
      riskLevel,
      regulatoryBody: metadata?.regulatoryBody,
      expirationDate: metadata?.expirationDate,
      jurisdiction: metadata?.jurisdiction,
      linkedEntity: metadata?.linkedEntity,
      tags: metadata?.tags || [],
      assignedTo: { name: 'Usuario Actual', email: 'usuario@empresa.com' },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockDocuments.push(newDocument);
    res.status(201).json(newDocument);
  } catch (error) {
    res.status(500).json({ message: 'Error creating document', error });
  }
};

export const updateDocument = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, description, type, status, riskLevel, metadata } = req.body;

    const documentIndex = mockDocuments.findIndex(doc => doc.id === id);
    if (documentIndex === -1) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const updatedDocument = {
      ...mockDocuments[documentIndex],
      title: title || mockDocuments[documentIndex].title,
      description: description || mockDocuments[documentIndex].description,
      type: type || mockDocuments[documentIndex].type,
      status: status || mockDocuments[documentIndex].status,
      riskLevel: riskLevel || mockDocuments[documentIndex].riskLevel,
      regulatoryBody: metadata?.regulatoryBody || mockDocuments[documentIndex].regulatoryBody,
      expirationDate: metadata?.expirationDate || mockDocuments[documentIndex].expirationDate,
      jurisdiction: metadata?.jurisdiction || mockDocuments[documentIndex].jurisdiction,
      linkedEntity: metadata?.linkedEntity || mockDocuments[documentIndex].linkedEntity,
      tags: metadata?.tags || mockDocuments[documentIndex].tags,
      updatedAt: new Date()
    };

    mockDocuments[documentIndex] = updatedDocument;
    res.json(updatedDocument);
  } catch (error) {
    res.status(500).json({ message: 'Error updating document', error });
  }
};

export const getDocumentById = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const document = mockDocuments.find(doc => doc.id === id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching document', error });
  }
};

