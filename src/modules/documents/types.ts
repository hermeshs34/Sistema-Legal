
export const DocumentType = {
    CONTRACT: 'contract',
    POLICY: 'policy',
    REGULATORY: 'regulatory',
    EVIDENCE: 'evidence',
    LEGAL_OPINION: 'legal_opinion',
    PERMIT_LICENSE: 'permit_license',
    CIRCULAR_MEMO: 'circular_memo',
    CORPORATE_GOVERNANCE: 'corporate_governance',
    TAX_FISCAL: 'tax_fiscal',
    LABOR: 'labor',
    INSURANCE: 'insurance',
    OTHER: 'other'
} as const;

export type DocumentType = typeof DocumentType[keyof typeof DocumentType];

export const DocumentStatus = {
    DRAFT: 'draft',
    IN_REVIEW: 'in_review',
    APPROVED: 'approved',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
    EXPIRED: 'expired'
} as const;

export type DocumentStatus = typeof DocumentStatus[keyof typeof DocumentStatus];

export const RiskLevel = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
} as const;

export type RiskLevel = typeof RiskLevel[keyof typeof RiskLevel];

export const SignatureStatus = {
    PENDING: 'pending',
    SIGNED_DIGITALLY: 'signed_digitally',
    NOTARIZED: 'notarized',
    APOSTILLED: 'apostilled'
} as const;

export type SignatureStatus = typeof SignatureStatus[keyof typeof SignatureStatus];

export interface DocumentAuditLog {
    id: string;
    action: 'created' | 'updated' | 'status_change' | 'exported';
    user: string; // User ID or Name
    timestamp: string;
    details: string;
}

export interface DocumentMetadata {
    regulatoryBody?: string;
    expirationDate?: string; // ISO Date
    jurisdiction?: string;
    tags?: string[];
    linkedEntity?: string; // Client ID, Counterparty Name, etc.
}

export interface Document {
    id: string;
    title: string;
    description: string;
    type: DocumentType;
    status: DocumentStatus;
    riskLevel: RiskLevel;
    version: string;
    createdAt: string;
    updatedAt: string;
    metadata: DocumentMetadata;
    signatureStatus?: SignatureStatus;
    assignedTo?: string; // Lawyer/Consultant in charge
    auditLog?: DocumentAuditLog[];
    organizationId?: string;
    region?: 'nacional' | 'internacional';
    fileUrl?: string;
    createdBy?: string;
}

export interface DocumentFilter {
    type?: DocumentType;
    status?: DocumentStatus;
    riskLevel?: RiskLevel;
    assignedTo?: string;
    search?: string;
}
