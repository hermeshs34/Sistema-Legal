export type ContractStatus = 'DRAFT' | 'REVIEW' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'CANCELLED';
export type ContractType = 'SERVICE' | 'EMPLOYMENT' | 'NDA' | 'LEASE' | 'PARTNERSHIP' | 'SUPPLY' | 'CONSULTING' | 'FRANCHISE' | 'LOAN' | 'OTHER';

export interface Contract {
    id: string;
    title: string;
    type: ContractType;
    status: ContractStatus;
    parties: string[];
    startDate: string;
    endDate?: string;
    value?: number;
    currency?: 'VES' | 'USD' | 'EUR';
    assignedLawyerId: string;
    assignedLawyerName?: string;
    description: string;
    content_draft?: string;
    file_url?: string;
    analysis_id?: string;
    /** ID del documento fuente en tabla `documents`. Evita duplicar archivos entre módulos. */
    document_id?: string;
    metadata: {
        urgent: boolean;
        autoRenewal: boolean;
        confidential: boolean;
        [key: string]: any; // Permite campos forenses extra (biometría, geo, etc)
    };
    organizationId?: string;
    // Firma electrónica (LDFE Venezuela)
    signature_status?: 'unsigned' | 'pending' | 'signed_basic' | 'signed_advanced';
    signature_hash?: string;
    signature_token?: string;
    signed_at?: string;
    signed_by_name?: string;
    signed_by_email?: string;
}
