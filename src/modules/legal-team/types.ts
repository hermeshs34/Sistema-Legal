import type { InpreStatus } from './inpreabogado.service.ts';

export type LawyerType = 'INTERNAL' | 'EXTERNAL';

export interface Lawyer {
    id: string;
    name: string;
    email: string;
    phone: string;
    inpreabogado: string;
    type: LawyerType;
    specialty: string; // e.g., 'Corporativo', 'Litigio', 'Compliance'
    isActive: boolean;
    organizationId?: string;
    // ── Verificación INPRE ───────────────────────────────────────────────────
    inpreStatus?: InpreStatus;
    inpreVerifiedAt?: string;
    inpreNextReview?: string;
}
