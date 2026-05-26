import { supabase } from '../../core/supabase.ts';

export interface SecurityConfig {
    id:                     string;
    organization_id:        string;
    mfa_roles_hardcoded:    string[];
    mfa_roles_enabled:      string[];
    session_timeout_minutos: number;
    password_vigencia_dias: number;
    password_aviso_dias:    number;
    updated_at:             string;
    updated_by:             string | null;
}

const DEFAULTS: Omit<SecurityConfig, 'id' | 'organization_id' | 'updated_at' | 'updated_by'> = {
    mfa_roles_hardcoded:    ['compliance_officer', 'auditor_externo'],
    mfa_roles_enabled:      ['consultor_general', 'abogado_senior', 'gerente_firma'],
    session_timeout_minutos: 90,
    password_vigencia_dias:  90,
    password_aviso_dias:     15,
};

class SecurityConfigService {

    async get(organizationId: string): Promise<SecurityConfig | null> {
        const { data, error } = await supabase
            .from('security_config')
            .select('*')
            .eq('organization_id', organizationId)
            .maybeSingle();

        if (error) throw new Error(error.message);
        return data as SecurityConfig | null;
    }

    async getOrDefault(organizationId: string): Promise<SecurityConfig> {
        const existing = await this.get(organizationId);
        if (existing) return existing;

        // Crear config por defecto si no existe
        const { data, error } = await supabase
            .from('security_config')
            .insert({ organization_id: organizationId, ...DEFAULTS })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as SecurityConfig;
    }

    async update(
        organizationId: string,
        updatedBy: string,
        patch: Partial<Pick<SecurityConfig,
            'mfa_roles_enabled' |
            'session_timeout_minutos' |
            'password_vigencia_dias' |
            'password_aviso_dias'
        >>
    ): Promise<SecurityConfig> {
        const { data, error } = await supabase
            .from('security_config')
            .update({ ...patch, updated_by: updatedBy })
            .eq('organization_id', organizationId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data as SecurityConfig;
    }

    /** Indica si un rol requiere MFA según la config activa. */
    rolRequiereMFA(role: string, config: SecurityConfig): boolean {
        return (
            config.mfa_roles_hardcoded.includes(role) ||
            config.mfa_roles_enabled.includes(role)
        );
    }

    /** Roles hardcoded (regulatorio) — no modificables desde UI. */
    readonly rolesHardcoded = ['compliance_officer', 'auditor_externo'];
}

export const securityConfigService = new SecurityConfigService();
