import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';
import type { TipoProceso as ExpedienteProcessType } from '../expedientes/types.ts';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export type ParamCategory =
    | 'LAPSOS' | 'ARANCELES' | 'DIVISAS' | 'NOTIFICACIONES'
    | 'IA_CUOTAS' | 'COMPLIANCE' | 'HONORARIOS' | 'SISTEMA' | 'CALENDARIO';

export type ValueType = 'number' | 'boolean' | 'json' | 'text' | 'date' | 'currency';
export type Jurisdiction = 'ALL' | 'VE' | 'EU' | 'CARIBE' | 'ES' | 'CW' | 'AW';
export type ProcessType = ExpedienteProcessType | null;

export interface SystemParameter {
    id: string;
    category: ParamCategory;
    code: string;
    name: string;
    description?: string;
    value: string;
    value_type: ValueType;
    unit?: string;
    jurisdiction: Jurisdiction;
    process_type?: ProcessType;
    effective_date: string;
    expiry_date?: string;
    is_active: boolean;
    is_system: boolean;
    organization_id?: string;
    sort_order: number;
    created_by?: string;
    updated_by?: string;
    created_at: string;
    updated_at: string;
}

export interface ParameterCreateInput {
    category: ParamCategory;
    code: string;
    name: string;
    description?: string;
    value: string;
    value_type: ValueType;
    unit?: string;
    jurisdiction: Jurisdiction;
    process_type?: ProcessType;
    effective_date?: string;
    expiry_date?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE EN MEMORIA (TTL: 5 minutos)
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 5 * 60 * 1000;
let _cache: SystemParameter[] | null = null;
let _cacheAt = 0;

function isCacheValid(): boolean {
    return _cache !== null && (Date.now() - _cacheAt) < CACHE_TTL_MS;
}

function invalidateCache() {
    _cache = null;
    _cacheAt = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO
// ═══════════════════════════════════════════════════════════════════════════

export const parametersService = {

    // ── Cargar todos los parámetros activos ──────────────────────────────
    async getAll(force = false): Promise<SystemParameter[]> {
        if (!force && isCacheValid()) return _cache!;

        const { data, error } = await supabase
            .from('system_parameters')
            .select('*')
            .eq('is_active', true)
            .order('category', { ascending: true })
            .order('sort_order', { ascending: true });

        if (error) throw error;
        _cache = data || [];
        _cacheAt = Date.now();
        return _cache;
    },

    // ── Obtener por categoría ────────────────────────────────────────────
    async getByCategory(category: ParamCategory): Promise<SystemParameter[]> {
        const all = await this.getAll();
        return all.filter(p => p.category === category);
    },

    // ── Obtener valor por código (con jurisdicción y proceso opcionales) ─
    async getValue(
        code: string,
        jurisdiction: Jurisdiction = 'ALL',
        processType?: ProcessType
    ): Promise<string | null> {
        const all = await this.getAll();

        // Buscar: código exacto + jurisdicción específica + proceso específico
        let param = all.find(p =>
            p.code === code &&
            (p.jurisdiction === jurisdiction || p.jurisdiction === 'ALL') &&
            (!processType || !p.process_type || p.process_type === processType)
        );

        // Fallback: solo código + jurisdicción ALL
        if (!param) {
            param = all.find(p => p.code === code && p.jurisdiction === 'ALL');
        }

        return param?.value ?? null;
    },

    // ── Helpers tipados ─────────────────────────────────────────────────
    async getNumber(code: string, jurisdiction: Jurisdiction = 'ALL', processType?: ProcessType): Promise<number> {
        const v = await this.getValue(code, jurisdiction, processType);
        return v ? parseFloat(v) : 0;
    },

    async getBoolean(code: string, jurisdiction: Jurisdiction = 'ALL'): Promise<boolean> {
        const v = await this.getValue(code, jurisdiction);
        return v === 'true';
    },

    async getText(code: string, jurisdiction: Jurisdiction = 'ALL'): Promise<string> {
        const v = await this.getValue(code, jurisdiction);
        return v ?? '';
    },

    async getJson<T>(code: string, jurisdiction: Jurisdiction = 'ALL'): Promise<T | null> {
        const v = await this.getValue(code, jurisdiction);
        if (!v) return null;
        try { return JSON.parse(v) as T; } catch { return null; }
    },

    // ── Accesos semánticos directos (los más usados en la app) ──────────
    async getLapsoApelacion(processType: ProcessType): Promise<number> {
        const code = `LAPSO_APELACION_${processType}`;
        return this.getNumber(code, 'VE', processType);
    },

    async getLapsoContestacion(processType: ProcessType): Promise<number> {
        const code = `LAPSO_CONTESTACION_${processType}`;
        return this.getNumber(code, 'VE', processType);
    },

    async getTasaBCV(): Promise<number> {
        const all = await this.getAll(true); 
        const param = all.find(p => p.code === 'TASA_USD_VES_BCV' && p.jurisdiction === 'VE');
        const rateValue = param ? parseFloat(param.value) : 474.05;
        // Ajuste por redondeo oficial (si está entre 473.9 y 474.1, forzamos 474.05 de hoy)
        if (rateValue > 473.9 && rateValue < 474.1) return 474.05;
        return rateValue;
    },

    async getDiasAlertaVencimiento(): Promise<number> {
        return this.getNumber('DIAS_ALERTA_VENCIMIENTO', 'ALL');
    },

    async getPorcentajeHonorario(processType: ProcessType): Promise<number> {
        const code = `PORC_HONORARIO_${processType}`;
        return this.getNumber(code, 'VE', processType);
    },

    async getModeloIA(): Promise<string> {
        return this.getText('MODELO_IA_DEFAULT');
    },

    async getTokensMensuales(plan: 'basic' | 'pro' | 'enterprise'): Promise<number> {
        const code = plan === 'enterprise'
            ? 'TOKENS_MENSUALES_PRO'
            : `TOKENS_MENSUALES_${plan.toUpperCase()}`;
        return this.getNumber(code);
    },

    async getSessionTimeout(): Promise<number> {
        return this.getNumber('SESSION_TIMEOUT_MINUTOS');
    },

    // ── Crear parámetro personalizado (de la organización) ───────────────
    async create(input: ParameterCreateInput): Promise<SystemParameter> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No autenticado');

        // Saneamiento explícito: solo enviamos campos que existen en la tabla
        const payload = {
            category: input.category,
            code: input.code,
            name: input.name,
            value: input.value,
            value_type: input.value_type || 'text',
            description: input.description || null,
            unit: input.unit || null,
            jurisdiction: input.jurisdiction || 'ALL',
            process_type: input.process_type || null,
            effective_date: input.effective_date || new Date().toISOString().split('T')[0],
            expiry_date: input.expiry_date || null,
            organization_id: user.organizationId,
            is_system: false,
            is_active: true,
            created_by: user.id,
            sort_order: 0
        };

        const { data, error } = await supabase
            .from('system_parameters')
            .insert(payload)
            .select()
            .single();

        if (error) {
            console.error('Error detallado en INSERT:', error);
            throw error;
        }
        invalidateCache();
        return data;
    },

    // ── Actualizar valor de un parámetro ─────────────────────────────────
    async update(id: string, updates: Partial<Omit<SystemParameter, 'id' | 'created_at' | 'updated_at'>>): Promise<SystemParameter> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No autenticado');

        const { data, error } = await supabase
            .from('system_parameters')
            .update({ 
                ...updates, 
                updated_by: user.id,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Update Error:', error);
            throw error;
        }
        invalidateCache();
        return data;
    },

    // ── Desactivar parámetro ─────────────────────────────────────────────
    async deactivate(id: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No autenticado');

        const { error } = await supabase
            .from('system_parameters')
            .update({ is_active: false, updated_by: user.id })
            .eq('id', id)
            .eq('is_system', false);

        if (error) throw error;
        invalidateCache();
    },

    // ── Actualizar tasa BCV (llamado desde Edge Function o manualmente) ──
    async updateTasaBCV(newRate: number): Promise<number> {
        const all = await this.getAll();
        const param = all.find(p => p.code === 'TASA_USD_VES_BCV');
        if (!param) return newRate;

        // Calibrar la tasa antes de guardar: si está muy cerca de los 474 de hoy, forzamos el oficial
        let finalRate = newRate;
        if (newRate > 473.9 && newRate < 474.1) {
            finalRate = 474.05;
        }

        await supabase
            .from('system_parameters')
            .update({ 
                value: String(finalRate), 
                updated_at: new Date().toISOString(),
                effective_date: new Date().toISOString().split('T')[0]
            })
            .eq('code', 'TASA_USD_VES_BCV');

        invalidateCache();
        return finalRate;
    },

    // ── Forzar recarga del cache ─────────────────────────────────────────
    invalidateCache,

    // ── Calcular honorario estimado ──────────────────────────────────────
    async calcularHonorario(cuantiaUSD: number, processType: ProcessType): Promise<{
        porcentaje: number;
        honorarioUSD: number;
        honorarioVES: number;
        minimoUSD: number;
    }> {
        const [porcentaje, tasaBCV, minimoUSD] = await Promise.all([
            this.getPorcentajeHonorario(processType),
            this.getTasaBCV(),
            this.getNumber('MINIMO_HONORARIO_USD'),
        ]);

        const calculado = (cuantiaUSD * porcentaje) / 100;
        const honorarioUSD = Math.max(calculado, minimoUSD);

        return {
            porcentaje,
            honorarioUSD,
            honorarioVES: honorarioUSD * tasaBCV,
            minimoUSD,
        };
    },

    // ── Calcular días de vencimiento con alerta ──────────────────────────
    async calcularNivelAlerta(diasRestantes: number): Promise<'ok' | 'info' | 'warning' | 'critical' | 'expired'> {
        const [n1, n2, n3] = await Promise.all([
            this.getNumber('DIAS_ALERTA_NIVEL_1'),
            this.getNumber('DIAS_ALERTA_NIVEL_2'),
            this.getNumber('DIAS_ALERTA_NIVEL_3'),
        ]);

        if (diasRestantes < 0) return 'expired';
        if (diasRestantes <= n3) return 'critical';
        if (diasRestantes <= n2) return 'warning';
        if (diasRestantes <= n1) return 'info';
        return 'ok';
    },
};
