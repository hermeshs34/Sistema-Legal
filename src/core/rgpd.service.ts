/**
 * rgpd.service.ts — FASE 2: ARCO+ Completo
 *
 * Gestiona el ciclo completo de privacidad según:
 *   → RGPD (UE) 2016/679 — Arts. 15-22 (derechos del interesado)
 *   → LOPDGDD 3/2018 — España
 *   → LDPFE Venezuela (referencia local)
 *
 * Derechos implementados (ARCO+):
 *   A — Acceso (Art. 15)         → exportUserData()
 *   R — Rectificación (Art. 16)  → requestRectification()
 *   C — Cancelación (Art. 17)    → requestErasure()        [Derecho al Olvido]
 *   O — Oposición (Art. 21)      → requestOpposition()
 *   + Portabilidad (Art. 20)     → exportPortableData()
 *   + Limitación (Art. 18)       → requestRestriction()
 *   + Retirada de consentimiento → withdrawConsent()
 */

import { supabase } from './supabase.ts';

export const CURRENT_POLICY_VERSION = 'v1.0-2026';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type ARCORequestType =
    | 'access'          // Art. 15 — Acceso
    | 'rectification'   // Art. 16 — Rectificación
    | 'erasure'         // Art. 17 — Supresión / Derecho al olvido
    | 'restriction'     // Art. 18 — Limitación del tratamiento
    | 'portability'     // Art. 20 — Portabilidad
    | 'opposition';     // Art. 21 — Oposición

export type ARCORequestStatus = 'pending' | 'in_review' | 'resolved' | 'rejected';

export interface ARCORequest {
    id:           string;
    user_id:      string;
    type:         ARCORequestType;
    status:       ARCORequestStatus;
    description:  string;
    resolution?:  string;
    created_at:   string;
    resolved_at?: string;
    deadline:     string;   // 30 días hábiles — RGPD Art. 12.3
}

// ── Servicio ─────────────────────────────────────────────────────────────────

export class RgpdService {

    // ── Consentimiento ────────────────────────────────────────────────────────

    /**
     * Verifica si el usuario tiene consentimiento activo en la versión actual.
     */
    async hasConsent(userId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('rgpd_consents')
            .select('id, withdrawn_at')
            .eq('user_id', userId)
            .eq('policy_version', CURRENT_POLICY_VERSION)
            .is('withdrawn_at', null)
            .limit(1)
            .single();

        if (error || !data) return false;
        return true;
    }

    /**
     * Registra el consentimiento con metadatos de trazabilidad legal.
     */
    async grantConsent(userId: string, organizationId: string): Promise<void> {
        const { error } = await supabase
            .from('rgpd_consents')
            .insert({
                user_id:         userId,
                organization_id: organizationId,
                policy_version:  CURRENT_POLICY_VERSION,
                accepted_at:     new Date().toISOString(),
                user_agent:      navigator.userAgent,
                ip_hint:         'client-side',  // IP real registrada server-side en Edge Fn
            });

        if (error) throw new Error('Error al registrar el consentimiento: ' + error.message);
    }

    /**
     * Retira el consentimiento — RGPD Art. 7.3.
     * Marca withdrawn_at sin borrar el registro (audit trail).
     */
    async withdrawConsent(userId: string): Promise<void> {
        const { error } = await supabase
            .from('rgpd_consents')
            .update({ withdrawn_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('policy_version', CURRENT_POLICY_VERSION)
            .is('withdrawn_at', null);

        if (error) throw new Error('Error al retirar el consentimiento: ' + error.message);
    }

    // ── Derecho de Acceso — Art. 15 ───────────────────────────────────────────

    /**
     * Exporta todos los datos personales del usuario (DSAR).
     * Incluye: perfil, consentimientos, logs de auditoría, contratos asignados.
     */
    async exportUserData(userId: string): Promise<Record<string, unknown>> {
        const [profileRes, consentsRes, auditRes, contractsRes] = await Promise.all([
            supabase.from('profiles').select('id, name, email, role, is_active, created_at').eq('id', userId).single(),
            supabase.from('rgpd_consents').select('policy_version, accepted_at, withdrawn_at, user_agent').eq('user_id', userId),
            supabase.from('audit_logs').select('action, entity_type, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
            supabase.from('contracts').select('id, title, type, status, created_at').eq('assigned_lawyer_id', userId),
        ]);

        return {
            exported_at:    new Date().toISOString(),
            policy_basis:   'RGPD Art. 15 — Derecho de Acceso / DSAR',
            policy_version: CURRENT_POLICY_VERSION,
            profile:        profileRes.data,
            consents:       consentsRes.data,
            audit_trail:    auditRes.data,
            contracts:      contractsRes.data,
        };
    }

    /**
     * Descarga el JSON de datos personales del usuario.
     */
    async downloadUserData(userId: string): Promise<void> {
        const data = await this.exportUserData(userId);
        this._downloadJson(data, `mis-datos-legaldoc-${new Date().toISOString().split('T')[0]}.json`);
    }

    // ── Portabilidad — Art. 20 ────────────────────────────────────────────────

    /**
     * Exporta los datos en formato portable (JSON estructurado).
     * Solo incluye datos que el usuario proporcionó activamente (no derivados/inferidos).
     */
    async exportPortableData(userId: string): Promise<void> {
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email, created_at')
            .eq('id', userId)
            .single();

        const portableData = {
            schema:        'legaldoc-portable-v1',
            exported_at:   new Date().toISOString(),
            basis:         'RGPD Art. 20 — Portabilidad de Datos',
            user_provided: { profile },
        };

        this._downloadJson(portableData, `datos-portables-legaldoc-${new Date().toISOString().split('T')[0]}.json`);
    }

    // ── Solicitudes ARCO+ (trazadas en BD) ────────────────────────────────────

    /**
     * Crea una solicitud ARCO+ registrada en BD con plazo legal de 30 días.
     * El DPO / compliance_officer debe resolverla en ese plazo.
     */
    async createARCORequest(
        userId:      string,
        orgId:       string,
        type:        ARCORequestType,
        description: string
    ): Promise<ARCORequest> {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);   // RGPD Art. 12.3 — 30 días

        const { data, error } = await supabase
            .from('rgpd_arco_requests')
            .insert({
                user_id:         userId,
                organization_id: orgId,
                type,
                description,
                status:          'pending',
                deadline:        deadline.toISOString(),
            })
            .select()
            .single();

        if (error || !data) throw new Error('Error creando solicitud ARCO+: ' + error?.message);
        return data as ARCORequest;
    }

    /**
     * Rectificación — Art. 16.
     * Crea solicitud formal para corregir datos inexactos o incompletos.
     */
    async requestRectification(userId: string, orgId: string, corrections: string): Promise<ARCORequest> {
        return this.createARCORequest(userId, orgId, 'rectification',
            `Solicitud de rectificación de datos: ${corrections}`);
    }

    /**
     * Derecho al Olvido / Supresión — Art. 17.
     * No borra inmediatamente — crea solicitud que el DPO debe evaluar
     * (puede haber obligación legal de conservar ciertos datos, ej: audit_logs).
     */
    async requestErasure(userId: string, orgId: string, reason: string): Promise<ARCORequest> {
        return this.createARCORequest(userId, orgId, 'erasure',
            `Solicitud de supresión (Derecho al Olvido): ${reason}`);
    }

    /**
     * Limitación del tratamiento — Art. 18.
     * Suspende el procesamiento mientras se resuelve una impugnación.
     */
    async requestRestriction(userId: string, orgId: string, reason: string): Promise<ARCORequest> {
        return this.createARCORequest(userId, orgId, 'restriction',
            `Solicitud de limitación del tratamiento: ${reason}`);
    }

    /**
     * Oposición — Art. 21.
     * El interesado se opone al tratamiento basado en interés legítimo.
     */
    async requestOpposition(userId: string, orgId: string, reason: string): Promise<ARCORequest> {
        return this.createARCORequest(userId, orgId, 'opposition',
            `Solicitud de oposición al tratamiento: ${reason}`);
    }

    /**
     * Lista todas las solicitudes ARCO+ del usuario.
     */
    async getUserARCORequests(userId: string): Promise<ARCORequest[]> {
        const { data, error } = await supabase
            .from('rgpd_arco_requests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) return [];
        return (data ?? []) as ARCORequest[];
    }

    /**
     * Lista todas las solicitudes ARCO+ pendientes de la organización (para DPO / compliance_officer).
     */
    async getOrgPendingARCORequests(orgId: string): Promise<ARCORequest[]> {
        const { data, error } = await supabase
            .from('rgpd_arco_requests')
            .select('*')
            .eq('organization_id', orgId)
            .in('status', ['pending', 'in_review'])
            .order('deadline', { ascending: true });  // Urgentes primero

        if (error) return [];
        return (data ?? []) as ARCORequest[];
    }

    /**
     * Resuelve una solicitud ARCO+ (solo DPO / compliance_officer).
     */
    async resolveARCORequest(
        requestId:  string,
        status:     'resolved' | 'rejected',
        resolution: string
    ): Promise<void> {
        const { error } = await supabase
            .from('rgpd_arco_requests')
            .update({
                status,
                resolution,
                resolved_at: new Date().toISOString(),
            })
            .eq('id', requestId);

        if (error) throw new Error('Error resolviendo solicitud ARCO+: ' + error.message);
    }

    // ── RAT — Registro de Actividades de Tratamiento ──────────────────────────
    // RGPD Art. 30 — Obligatorio para organizaciones >250 empleados
    // o que traten datos sensibles (datos legales, AML, etc.)

    /**
     * Retorna las actividades de tratamiento registradas para la organización.
     */
    async getRATEntries(orgId: string): Promise<Record<string, unknown>[]> {
        const { data, error } = await supabase
            .from('rgpd_rat')
            .select('*')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false });

        if (error) return [];
        return data ?? [];
    }

    /**
     * Crea una entrada en el RAT.
     */
    async createRATEntry(entry: {
        organization_id: string;
        name:            string;
        purpose:         string;
        legal_basis:     string;
        data_categories: string[];
        recipients:      string[];
        retention_period: string;
        security_measures: string;
        international_transfers?: string;
        created_by:      string;
    }): Promise<void> {
        const { error } = await supabase.from('rgpd_rat').insert(entry);
        if (error) throw new Error('Error creando entrada RAT: ' + error.message);
    }

    // ── Helper privado ────────────────────────────────────────────────────────

    private _downloadJson(data: unknown, filename: string): void {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const rgpdService = new RgpdService();
