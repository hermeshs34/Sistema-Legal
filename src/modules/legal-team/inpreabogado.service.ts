/**
 * inpreabogado.service.ts
 *
 * Gestión de la verificación del Registro INPRE (Instituto de Previsión Social
 * del Abogado) de Venezuela.
 *
 * Base legal:
 *   → Ley de Abogados (G.O. 26.781, 1967) — Art. 4: ejercicio exclusivo de inscritos
 *   → Código de Ética del Abogado Venezolano — Arts. 1, 13
 *   → Resolución TSJ — Inhabilitaciones y sanciones disciplinarias
 *
 * Nota: No existe API pública del INPRE para consulta en tiempo real.
 * El sistema implementa un flujo de verificación manual con trazabilidad completa.
 * Ciclo recomendado de re-verificación: 12 meses.
 */

import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type InpreStatus =
    | 'activo'         // Verificado y habilitado para el ejercicio
    | 'suspendido'     // Sancionado disciplinariamente
    | 'inhabilitado'   // Inhabilitación grave (temporal o permanente)
    | 'fallecido'      // Registro cerrado por fallecimiento
    | 'no_verificado'; // Sin verificar aún

export interface InpreVerification {
    id: string;
    organizationId: string;
    lawyerId: string;
    inpreabogado: string;
    status: InpreStatus;
    verifiedBy?: string;
    verifiedByName?: string;
    verifiedAt?: string;
    nextReview?: string;
    evidenceUrl?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface InpreAlert {
    lawyerId: string;
    lawyerName: string;
    inpreNumber: string;
    alertType: 'sin_verificar' | 'vencida' | 'suspendido' | 'inhabilitado';
    message: string;
    severity: 'warning' | 'critical';
    daysSinceVerification?: number;
}

// ── Configuración visual de estado ───────────────────────────────────────────

export const INPRE_STATUS_CONFIG: Record<InpreStatus, {
    label: string;
    color: string;
    bg: string;
    border: string;
    emoji: string;
    description: string;
}> = {
    activo: {
        label: 'INPRE Activo',
        color: '#166534',
        bg: '#f0fdf4',
        border: '#86efac',
        emoji: '✅',
        description: 'Inscripción INPRE verificada y habilitada para el ejercicio',
    },
    suspendido: {
        label: 'Suspendido',
        color: '#92400e',
        bg: '#fffbeb',
        border: '#fcd34d',
        emoji: '⚠️',
        description: 'Sanción disciplinaria activa — revisar resolución TSJ/INPRE',
    },
    inhabilitado: {
        label: 'Inhabilitado',
        color: '#991b1b',
        bg: '#fef2f2',
        border: '#fca5a5',
        emoji: '🚫',
        description: 'Inhabilitación grave para el ejercicio de la abogacía',
    },
    fallecido: {
        label: 'Fallecido',
        color: '#4b5563',
        bg: '#f9fafb',
        border: '#d1d5db',
        emoji: '⬜',
        description: 'Registro cerrado por fallecimiento del profesional',
    },
    no_verificado: {
        label: 'Sin Verificar',
        color: '#374151',
        bg: '#f3f4f6',
        border: '#d1d5db',
        emoji: '❓',
        description: 'Inscripción INPRE pendiente de verificación formal',
    },
};

// ── Días hasta expiración de verificación ────────────────────────────────────
const REVIEW_CYCLE_DAYS = 365; // 12 meses

// ── Servicio ─────────────────────────────────────────────────────────────────

class InpreabogadoService {

    /**
     * Obtiene la verificación INPRE de un abogado específico.
     */
    async getVerification(lawyerId: string): Promise<InpreVerification | null> {
        const user = authService.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('inpreabogado_verifications')
            .select(`
                *,
                verified_by_profile:profiles!verified_by(name)
            `)
            .eq('lawyer_id', lawyerId)
            .eq('organization_id', user.organizationId)
            .maybeSingle();

        if (error || !data) return null;
        return this._map(data);
    }

    /**
     * Obtiene todas las verificaciones INPRE de la organización.
     * Usado para la vista de administración global.
     */
    async getAllVerifications(): Promise<InpreVerification[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('inpreabogado_verifications')
            .select(`
                *,
                verified_by_profile:profiles!verified_by(name)
            `)
            .eq('organization_id', user.organizationId)
            .order('updated_at', { ascending: false });

        if (error) return [];
        return (data || []).map(d => this._map(d));
    }

    /**
     * Registra o actualiza la verificación INPRE de un abogado.
     * Solo roles: consultor_general, abogado_senior, compliance_officer, gerente_firma.
     */
    async saveVerification(params: {
        lawyerId:    string;
        inpre:       string;
        status:      InpreStatus;
        notes?:      string;
        evidenceUrl?: string;
    }): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No autenticado');

        const allowedRoles = ['consultor_general', 'abogado_senior', 'compliance_officer', 'gerente_firma'];
        if (!allowedRoles.includes(user.role)) {
            throw new Error('No tiene permisos para verificar registros INPRE');
        }

        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + REVIEW_CYCLE_DAYS);

        const payload = {
            organization_id: user.organizationId,
            lawyer_id:       params.lawyerId,
            inpreabogado:    params.inpre.trim().toUpperCase(),
            status:          params.status,
            verified_by:     user.id,
            verified_at:     new Date().toISOString(),
            next_review:     nextReview.toISOString(),
            notes:           params.notes ?? null,
            evidence_url:    params.evidenceUrl ?? null,
        };

        const { error } = await supabase
            .from('inpreabogado_verifications')
            .upsert(payload, { onConflict: 'lawyer_id,organization_id' });

        if (error) throw new Error('Error guardando verificación INPRE: ' + error.message);
    }

    /**
     * Genera alertas de estado INPRE para toda la organización.
     * Tipos de alerta:
     *  - sin_verificar: nunca fue verificado
     *  - vencida: última verificación > 12 meses
     *  - suspendido: estado activo suspendido
     *  - inhabilitado: estado inhabilitado
     */
    async getAlerts(lawyers: { id: string; name: string; inpreabogado: string }[]): Promise<InpreAlert[]> {
        const verifications = await this.getAllVerifications();
        const verifMap = new Map(verifications.map(v => [v.lawyerId, v]));
        const alerts: InpreAlert[] = [];
        const today = new Date();

        for (const lawyer of lawyers) {
            const v = verifMap.get(lawyer.id);

            if (!v || v.status === 'no_verificado') {
                alerts.push({
                    lawyerId: lawyer.id,
                    lawyerName: lawyer.name,
                    inpreNumber: lawyer.inpreabogado,
                    alertType: 'sin_verificar',
                    message: 'Registro INPRE sin verificación formal. Requerido por Ley de Abogados Art. 4.',
                    severity: 'warning',
                });
                continue;
            }

            if (v.status === 'suspendido') {
                alerts.push({
                    lawyerId: lawyer.id,
                    lawyerName: lawyer.name,
                    inpreNumber: lawyer.inpreabogado,
                    alertType: 'suspendido',
                    message: 'Profesional con sanción disciplinaria activa. Verificar resolución TSJ/INPRE.',
                    severity: 'critical',
                });
            }

            if (v.status === 'inhabilitado') {
                alerts.push({
                    lawyerId: lawyer.id,
                    lawyerName: lawyer.name,
                    inpreNumber: lawyer.inpreabogado,
                    alertType: 'inhabilitado',
                    message: 'Profesional inhabilitado para el ejercicio. No puede suscribir actuaciones.',
                    severity: 'critical',
                });
            }

            if (v.status === 'activo' && v.verifiedAt) {
                const verifiedDate = new Date(v.verifiedAt);
                const daysDiff = Math.floor((today.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));

                if (daysDiff > REVIEW_CYCLE_DAYS) {
                    alerts.push({
                        lawyerId: lawyer.id,
                        lawyerName: lawyer.name,
                        inpreNumber: lawyer.inpreabogado,
                        alertType: 'vencida',
                        message: `Verificación INPRE vencida hace ${daysDiff - REVIEW_CYCLE_DAYS} días. Requiere nueva verificación.`,
                        severity: daysDiff > REVIEW_CYCLE_DAYS + 90 ? 'critical' : 'warning',
                        daysSinceVerification: daysDiff,
                    });
                }
            }
        }

        // Ordenar: críticos primero
        return alerts.sort((a, b) => {
            if (a.severity === b.severity) return 0;
            return a.severity === 'critical' ? -1 : 1;
        });
    }

    /**
     * Calcula los días restantes para vencimiento de verificación.
     * Retorna null si no hay verificación activa.
     */
    daysUntilReview(verification: InpreVerification | null): number | null {
        if (!verification?.nextReview) return null;
        const diff = new Date(verification.nextReview).getTime() - Date.now();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    // ── Mapper privado ────────────────────────────────────────────────────────

    private _map(d: any): InpreVerification {
        return {
            id:               d.id,
            organizationId:   d.organization_id,
            lawyerId:         d.lawyer_id,
            inpreabogado:     d.inpreabogado,
            status:           d.status as InpreStatus,
            verifiedBy:       d.verified_by ?? undefined,
            verifiedByName:   d.verified_by_profile?.name ?? undefined,
            verifiedAt:       d.verified_at ?? undefined,
            nextReview:       d.next_review ?? undefined,
            evidenceUrl:      d.evidence_url ?? undefined,
            notes:            d.notes ?? undefined,
            createdAt:        d.created_at,
            updatedAt:        d.updated_at,
        };
    }
}

export const inpreService = new InpreabogadoService();
