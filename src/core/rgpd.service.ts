/**
 * rgpd.service.ts
 * FASE 1 — RGPD Foundation para LegalDoc VE (España / Europa)
 *
 * Gestiona el consentimiento de privacidad de datos según:
 *   → Reglamento (UE) 2016/679 (RGPD)
 *   → Ley Orgánica 3/2018 (LOPDGDD — España)
 *   → Ley de Datos y Firmas Electrónicas de Venezuela (referencia local)
 *
 * Uso: llamar checkConsent() al iniciar sesión.
 *      Si retorna false, mostrar RgpdConsentBanner antes de entrar al sistema.
 */

import { supabase } from './supabase.ts';

export const CURRENT_POLICY_VERSION = 'v1.0-2026';

class RgpdService {
    /**
     * Verifica si el usuario ya otorgó consentimiento con la versión actual de la política.
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
     * Registra el consentimiento del usuario con metadatos para trazabilidad legal.
     */
    async grantConsent(userId: string, organizationId: string): Promise<void> {
        const { error } = await supabase
            .from('rgpd_consents')
            .insert({
                user_id: userId,
                organization_id: organizationId,
                policy_version: CURRENT_POLICY_VERSION,
                accepted_at: new Date().toISOString(),
                user_agent: navigator.userAgent,
            });

        if (error) throw new Error('Error al registrar el consentimiento: ' + error.message);
    }

    /**
     * Retira el consentimiento (derecho de retirada RGPD Art. 7.3).
     * No borra el registro — solo marca withdrawn_at para el audit trail.
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

    /**
     * Exporta todos los datos personales del usuario (DSAR — Derecho de Acceso RGPD Art. 15).
     * Retorna un JSON descargable con toda la información almacenada.
     */
    async exportUserData(userId: string): Promise<Record<string, unknown>> {
        const [profileRes, consentsRes, auditRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', userId).single(),
            supabase.from('rgpd_consents').select('*').eq('user_id', userId),
            supabase.from('audit_logs').select('*').eq('user_id', userId),
        ]);

        return {
            exported_at: new Date().toISOString(),
            policy_basis: 'RGPD Art. 15 — Derecho de Acceso',
            profile: profileRes.data,
            consents: consentsRes.data,
            audit_trail: auditRes.data,
        };
    }

    /**
     * Trigger descarga del JSON de datos personales del usuario.
     */
    async downloadUserData(userId: string): Promise<void> {
        const data = await this.exportUserData(userId);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mis-datos-legaldoc-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const rgpdService = new RgpdService();
