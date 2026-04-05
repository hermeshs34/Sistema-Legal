export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'PENDING' | 'EXPIRED';
export type RiskArea = 'LEGAL' | 'TAX' | 'LABOR' | 'REGULATORY' | 'ENVIRONMENTAL' | 'OPERATIONAL';

export interface ComplianceItem {
    id: string;
    title: string;
    area: RiskArea;
    description: string;
    status: ComplianceStatus;
    riskLevel: RiskLevel;
    lastAssessment: string; // ISO date
    nextReview: string; // ISO date
    assignedLawyerId?: string;
    linkedDocumentId?: string;
    observations?: string;
    legalCitation?: string;
    organizationId?: string;
}

export interface RiskSummary {
    totalItems: number;
    compliantCount: number;
    nonCompliantCount: number;
    criticalRiskCount: number;
    highRiskCount: number;
    pendingTasks: number;
}
