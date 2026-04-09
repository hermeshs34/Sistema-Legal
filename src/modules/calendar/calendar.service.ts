import { supabase } from '../../core/supabase.ts';
import { parametersService } from '../parameters/parameters.service.ts';
import { authService } from '../../core/auth.service.ts';
import type { TipoProceso as ExpedienteProcessType } from '../expedientes/types.ts';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export type AlertLevel = 'ok' | 'info' | 'warning' | 'critical' | 'expired';
export type ProcessType = ExpedienteProcessType;

export interface JudicialHoliday {
    id: string;
    holiday_date: string;
    name: string;
    type: 'national' | 'regional' | 'judicial' | 'religious' | 'custom';
    jurisdiction: string;
    is_recurring: boolean;
    is_active: boolean;
    notes?: string;
}

export interface ExpedienteLapso {
    id: string;
    expediente_id: string;
    lapso_code: string;
    lapso_name: string;
    fecha_inicio: string;
    dias_habiles: number;
    fecha_vencimiento: string;
    alerted_level: AlertLevel;
    is_active: boolean;
}

export interface LapsoCalculado {
    code: string;
    name: string;
    diasHabiles: number;
    fechaInicio: Date;
    fechaVencimiento: Date;
    diasRestantes: number;
    diasHabilesRestantes: number;
    alertLevel: AlertLevel;
    porcentajeTranscurrido: number;
}

export interface CalendarAlert {
    expedienteId: string;
    expedienteTitulo: string;
    lapsoNombre: string;
    fechaVencimiento: Date;
    diasRestantes: number;
    alertLevel: AlertLevel;
}

// ── Config visual de alertas ─────────────────────────────────────────────
export const ALERT_CONFIG: Record<AlertLevel, { label: string; color: string; bg: string; border: string; emoji: string }> = {
    ok:       { label: 'Al día',     color: '#166534', bg: '#f0fdf4', border: '#86efac', emoji: '✅' },
    info:     { label: 'Próximo',    color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', emoji: '📅' },
    warning:  { label: 'Urgente',    color: '#92400e', bg: '#fffbeb', border: '#fcd34d', emoji: '⚠️' },
    critical: { label: 'Crítico',    color: '#991b1b', bg: '#fef2f2', border: '#fca5a5', emoji: '🚨' },
    expired:  { label: 'Vencido',    color: '#4b5563', bg: '#f9fafb', border: '#d1d5db', emoji: '💀' },
};

export type EventSource = 'AUDIENCIA' | 'LAPSO' | 'CUSTOM' | 'HOLIDAY';

export interface CalendarEvent {
    id: string;
    source: EventSource;
    title: string;
    description?: string;
    start: Date;
    end?: Date;
    color: string;
    status: string;
    metadata?: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO
// ═══════════════════════════════════════════════════════════════════════════

export const calendarService = {

    // ── Obtener feriados del año actual + siguiente ──────────────────────
    async getHolidays(jurisdiction = 'VE', year?: number): Promise<JudicialHoliday[]> {
        const targetYear = year ?? new Date().getFullYear();
        const { data, error } = await supabase
            .from('judicial_holidays')
            .select('*')
            .eq('is_active', true)
            .in('jurisdiction', [jurisdiction, 'ALL'])
            .or(`holiday_date.gte.${targetYear}-01-01,is_recurring.eq.true`)
            .order('holiday_date', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    // ── Calcular fecha de vencimiento usando función SQL ─────────────────
    async calcularFechaVencimiento(
        fechaInicio: Date,
        diasHabiles: number,
        jurisdiction = 'VE'
    ): Promise<Date> {
        const startStr = fechaInicio.toISOString().split('T')[0];
        const { data, error } = await supabase
            .rpc('calculate_business_days', {
                p_start_date: startStr,
                p_working_days: diasHabiles,
                p_jurisdiction: jurisdiction,
            });

        if (error || !data) {
            // Fallback: cálculo simple sin feriados
            return this._calcularFechaSinFeriados(fechaInicio, diasHabiles);
        }
        return new Date(data);
    },

    // ── Contar días hábiles entre dos fechas ─────────────────────────────
    async contarDiasHabiles(desde: Date, hasta: Date, jurisdiction = 'VE'): Promise<number> {
        const { data, error } = await supabase
            .rpc('count_business_days', {
                p_start_date: desde.toISOString().split('T')[0],
                p_end_date: hasta.toISOString().split('T')[0],
                p_jurisdiction: jurisdiction,
            });

        if (error || data === null) return 0;
        return data as number;
    },

    // ── Calcular nivel de alerta desde base paramétrica ──────────────────
    async calcularNivelAlerta(diasRestantes: number): Promise<AlertLevel> {
        return parametersService.calcularNivelAlerta(diasRestantes) as Promise<AlertLevel>;
    },

    // ── Calcular todos los lapsos para un expediente ─────────────────────
    async calcularLapsosExpediente(params: {
        expedienteId: string;
        fechaInicio: Date;
        processType: ProcessType;
        jurisdiction?: string;
    }): Promise<LapsoCalculado[]> {
        const { fechaInicio, processType, jurisdiction = 'VE' } = params;
        const hoy = new Date();

        // Obtener parámetros de lapsos desde base paramétrica
        const lapsosDefs = [
            {
                code: `LAPSO_APELACION_${processType}`,
                name: `Apelación (${processType})`,
            },
            {
                code: `LAPSO_CONTESTACION_${processType}`,
                name: `Contestación (${processType})`,
            },
            {
                code: `LAPSO_PRUEBAS_${processType}`,
                name: `Pruebas (${processType})`,
            },
        ].filter(l => l.code);

        const resultados: LapsoCalculado[] = [];

        for (const def of lapsosDefs) {
            const dias = await parametersService.getNumber(def.code, jurisdiction as any, processType);
            if (!dias) continue;

            const fechaVenc = await this.calcularFechaVencimiento(fechaInicio, dias, jurisdiction);
            const diasCalendarioRestantes = Math.floor((fechaVenc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
            const diasHabilesRestantes = diasCalendarioRestantes > 0
                ? await this.contarDiasHabiles(hoy, fechaVenc, jurisdiction)
                : 0;

            const alertLevel = await this.calcularNivelAlerta(diasCalendarioRestantes);
            const diasTotales = Math.floor((fechaVenc.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));
            const diasTranscurridos = Math.floor((hoy.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));
            const porcentaje = diasTotales > 0 ? Math.min(100, Math.round((diasTranscurridos / diasTotales) * 100)) : 100;

            resultados.push({
                code: def.code,
                name: def.name,
                diasHabiles: dias,
                fechaInicio,
                fechaVencimiento: fechaVenc,
                diasRestantes: diasCalendarioRestantes,
                diasHabilesRestantes,
                alertLevel,
                porcentajeTranscurrido: porcentaje,
            });
        }

        return resultados;
    },

    // ── Guardar lapsos calculados en BD ──────────────────────────────────
    async guardarLapsos(expedienteId: string, lapsos: LapsoCalculado[]): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const rows = lapsos.map(l => ({
            expediente_id: expedienteId,
            lapso_code: l.code,
            lapso_name: l.name,
            fecha_inicio: l.fechaInicio.toISOString().split('T')[0],
            dias_habiles: l.diasHabiles,
            fecha_vencimiento: l.fechaVencimiento.toISOString().split('T')[0],
            alerted_level: l.alertLevel,
            organization_id: user.organizationId,
            created_by: user.id,
        }));

        await supabase
            .from('expediente_lapsos')
            .upsert(rows, { onConflict: 'expediente_id,lapso_code' });
    },

    // ── Obtener lapsos guardados de un expediente ────────────────────────
    async getLapsosExpediente(expedienteId: string): Promise<ExpedienteLapso[]> {
        const { data } = await supabase
            .from('expediente_lapsos')
            .select('*')
            .eq('expediente_id', expedienteId)
            .eq('is_active', true)
            .order('fecha_vencimiento', { ascending: true });
        return data || [];
    },

    // ── Obtener alertas próximas a vencer (para dashboard) ───────────────
    async getProximasAlertas(diasAdelante = 14): Promise<ExpedienteLapso[]> {
        const hoy = new Date().toISOString().split('T')[0];
        const limite = new Date();
        limite.setDate(limite.getDate() + diasAdelante);
        const limiteStr = limite.toISOString().split('T')[0];

        const { data } = await supabase
            .from('expediente_lapsos')
            .select('*')
            .eq('is_active', true)
            .in('alerted_level', ['warning', 'critical', 'expired', 'info'])
            .gte('fecha_vencimiento', hoy)
            .lte('fecha_vencimiento', limiteStr)
            .order('fecha_vencimiento', { ascending: true });

        return data || [];
    },

    // ── Próximos días festivos ────────────────────────────────────────────
    async getProximosFestivos(dias = 30, jurisdiction = 'VE'): Promise<JudicialHoliday[]> {
        const hoy = new Date().toISOString().split('T')[0];
        const limite = new Date();
        limite.setDate(limite.getDate() + dias);
        const limiteStr = limite.toISOString().split('T')[0];

        const { data } = await supabase
            .from('judicial_holidays')
            .select('*')
            .eq('is_active', true)
            .in('jurisdiction', [jurisdiction, 'ALL'])
            .gte('holiday_date', hoy)
            .lte('holiday_date', limiteStr)
            .order('holiday_date', { ascending: true });

        return data || [];
    },

    // ── Verificar si una fecha es hábil ──────────────────────────────────
    async esDiaHabil(fecha: Date, jurisdiction = 'VE'): Promise<boolean> {
        const dow = fecha.getDay();
        if (dow === 0 || dow === 6) return false; // fin de semana

        const fechaStr = fecha.toISOString().split('T')[0];

        // Verificar manualmente si el día/mes coincide con feriado recurrente
        const mes = fecha.getMonth() + 1;
        const dia = fecha.getDate();
        const holidays = await this.getHolidays(jurisdiction);
        const esFeriado = holidays.some(h => {
            const hDate = new Date(h.holiday_date);
            if (h.is_recurring) {
                return hDate.getMonth() + 1 === mes && hDate.getDate() === dia;
            }
            return h.holiday_date === fechaStr;
        });

        return !esFeriado;
    },

    // ── Fallback: cálculo sin consulta a BD (offline) ────────────────────
    _calcularFechaSinFeriados(inicio: Date, diasHabiles: number): Date {
        const result = new Date(inicio);
        let contados = 0;
        while (contados < diasHabiles) {
            result.setDate(result.getDate() + 1);
            const dow = result.getDay();
            if (dow !== 0 && dow !== 6) contados++;
        }
        return result;
    },

    // ── Formatear fecha en español ────────────────────────────────────────
    formatFecha(fecha: Date): string {
        return fecha.toLocaleDateString('es-VE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    },

    // ── Formatear días restantes en texto ────────────────────────────────
    formatDiasRestantes(dias: number): string {
        if (dias < 0) return `Vencido hace ${Math.abs(dias)} días`;
        if (dias === 0) return '¡Vence HOY!';
        if (dias === 1) return 'Vence mañana';
        if (dias <= 7) return `Vence en ${dias} días`;
        if (dias <= 30) return `Vence en ${Math.ceil(dias / 7)} semanas`;
        return `Vence en ${Math.ceil(dias / 30)} meses`;
    },

    // ── Obtener todos los eventos unificados (Vista Global) ────────────────
    async getUnifiedGlobalEvents(start: Date, end: Date): Promise<CalendarEvent[]> {
        const startStr = start.toISOString();
        const endStr = end.toISOString();
        const startDateOnly = start.toISOString().split('T')[0];
        const endDateOnly = end.toISOString().split('T')[0];

        const [audiencias, lapsos, custom, holidays] = await Promise.all([
            supabase.from('audiencias').select('*, expedientes(titulo)').gte('fecha_hora', startStr).lte('fecha_hora', endStr),
            supabase.from('expediente_lapsos').select('*, expedientes(titulo)').gte('fecha_vencimiento', startDateOnly).lte('fecha_vencimiento', endDateOnly),
            supabase.from('judicial_calendar_custom').select('*').gte('start_at', startStr).lte('start_at', endStr),
            this.getHolidays('VE') // Por ahora general
        ]);

        const events: CalendarEvent[] = [];

        // 👨‍⚖️ AUDIENCIAS
        if (audiencias.data) {
            audiencias.data.forEach((aud: any) => {
                events.push({
                    id: aud.id,
                    source: 'AUDIENCIA',
                    title: `⚖️ Audiencia: ${aud.expedientes?.titulo || 'Caso'}`,
                    description: `${aud.tipo} en ${aud.tribunal || 'Tribunal'}`,
                    start: new Date(aud.fecha_hora),
                    color: '#4f46e5',
                    status: aud.status
                });
            });
        }

        // ⏰ LAPSOS
        if (lapsos.data) {
            lapsos.data.forEach((lap: any) => {
                events.push({
                    id: lap.id,
                    source: 'LAPSO',
                    title: `⏰ Vencimiento: ${lap.lapso_name}`,
                    description: `Expediente: ${lap.expedientes?.titulo || 'Caso'}`,
                    start: new Date(lap.fecha_vencimiento),
                    color: ALERT_CONFIG[lap.alerted_level as AlertLevel]?.color || '#64748b',
                    status: 'PENDING'
                });
            });
        }

        // 📅 CUSTOM
        if (custom.data) {
            custom.data.forEach((ev: any) => {
                events.push({
                    id: ev.id,
                    source: 'CUSTOM',
                    title: `💼 ${ev.title}`,
                    description: ev.description,
                    start: new Date(ev.start_at),
                    end: ev.end_at ? new Date(ev.end_at) : undefined,
                    color: '#6366f1',
                    status: ev.status
                });
            });
        }

        // 🏛️ HOLIDAYS
        holidays.forEach(h => {
             // Only if within dates
             const hDate = new Date(h.is_recurring ? `${start.getFullYear()}-${h.holiday_date.split('-').slice(1).join('-')}` : h.holiday_date);
             if (hDate >= start && hDate <= end) {
                events.push({
                    id: h.id,
                    source: 'HOLIDAY',
                    title: `🏛️ No Hábil: ${h.name}`,
                    start: hDate,
                    color: '#fbbf24',
                    status: 'CLOSED'
                });
             }
        });

        return events.sort((a, b) => a.start.getTime() - b.start.getTime());
    },
};
