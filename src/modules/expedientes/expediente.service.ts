import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';
import { auditService } from '../shared/audit.service.ts';
import type { Expediente, Actuacion, Audiencia } from './types.ts';

// ─── Mappers BD → Frontend ──────────────────────────────────────────────────

function mapExpediente(row: Record<string, unknown>): Expediente {
    return {
        id: row.id as string,
        organizationId: row.organization_id as string,
        titulo: row.titulo as string,
        numeroExpediente: row.numero_expediente as string | undefined,
        tribunal: row.tribunal as string | undefined,
        tipoProceso: row.tipo_proceso as Expediente['tipoProceso'],
        materia: row.materia as string | undefined,
        parteActora: row.parte_actora as string,
        parteDemandada: row.parte_demandada as string,
        nuestraPosicion: row.nuestra_posicion as Expediente['nuestraPosicion'],
        status: row.status as Expediente['status'],
        fechaInicio: row.fecha_inicio as string | undefined,
        fechaCierre: row.fecha_cierre as string | undefined,
        cuantia: row.cuantia ? Number(row.cuantia) : undefined,
        currency: (row.currency as Expediente['currency']) ?? 'USD',
        riesgo: row.riesgo as Expediente['riesgo'],
        assignedLawyerId: row.assigned_lawyer_id as string | undefined,
        contractId: row.contract_id as string | undefined,
        documentId: row.document_id as string | undefined,
        descripcion: row.descripcion as string | undefined,
        region: (row.region as string) ?? 'VE',
        createdBy: row.created_by as string | undefined,
        createdAt: row.created_at as string | undefined,
        updatedAt: row.updated_at as string | undefined,
    };
}

function mapActuacion(row: Record<string, unknown>): Actuacion {
    return {
        id: row.id as string,
        expedienteId: row.expediente_id as string,
        organizationId: row.organization_id as string,
        fecha: row.fecha as string,
        tipo: row.tipo as Actuacion['tipo'],
        descripcion: row.descripcion as string,
        resultado: row.resultado as string | undefined,
        proximoPaso: row.proximo_paso as string | undefined,
        archivoUrl: row.archivo_url as string | undefined,
        status: (row.status as any) || 'REALIZADA',
        createdBy: row.created_by as string | undefined,
        createdAt: row.created_at as string | undefined,
    };
}

function mapAudiencia(row: Record<string, unknown>): Audiencia {
    return {
        id: row.id as string,
        expedienteId: row.expediente_id as string,
        organizationId: row.organization_id as string,
        fechaHora: row.fecha_hora as string,
        tribunal: row.tribunal as string | undefined,
        sala: row.sala as string | undefined,
        tipo: row.tipo as Audiencia['tipo'],
        descripcion: row.descripcion as string | undefined,
        resultado: row.resultado as string | undefined,
        alertaEnviada: Boolean(row.alerta_enviada),
        diasAlerta: Number(row.dias_alerta ?? 3),
        status: row.status as Audiencia['status'],
        createdAt: row.created_at as string | undefined,
    };
}

// ─── Servicio ───────────────────────────────────────────────────────────────

export const expedienteService = {

    // ── Expedientes ─────────────────────────────────────────────────────────

    // ── Expedientes ─────────────────────────────────────────────────────────

    async getAll(): Promise<Expediente[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('expedientes')
            .select('*')
            .eq('organization_id', user.organizationId)
            .order('created_at', { ascending: false });
        if (error) { console.error('Error fetching expedientes:', error); return []; }
        return (data ?? []).map(mapExpediente);
    },

    async getById(id: string): Promise<Expediente | null> {
        const user = authService.getCurrentUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('expedientes')
            .select('*')
            .eq('id', id)
            .eq('organization_id', user.organizationId)
            .single();
        if (error || !data) return null;
        return mapExpediente(data);
    },

    async save(exp: Partial<Expediente> & { titulo: string; parteActora: string; parteDemandada: string }): Promise<string> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No hay sesión activa');
        
        const isNew = !exp.id;

        // Generar ID si es nuevo
        let id = exp.id;
        if (isNew) {
            const { data: idData } = await supabase.rpc('generate_expediente_id');
            id = idData as string;
        }

        const dbData = {
            id,
            organization_id: exp.organizationId ?? user.organizationId,
            titulo: exp.titulo,
            numero_expediente: exp.numeroExpediente ?? null,
            tribunal: exp.tribunal ?? null,
            tipo_proceso: exp.tipoProceso ?? 'CIVIL',
            materia: exp.materia ?? null,
            parte_actora: exp.parteActora,
            parte_demandada: exp.parteDemandada,
            nuestra_posicion: exp.nuestraPosicion ?? 'DEMANDADO',
            status: exp.status ?? 'ACTIVO',
            fecha_inicio: exp.fechaInicio ?? null,
            fecha_cierre: exp.fechaCierre ?? null,
            cuantia: exp.cuantia ?? null,
            currency: exp.currency ?? 'USD',
            riesgo: exp.riesgo ?? 'MEDIUM',
            assigned_lawyer_id: exp.assignedLawyerId ?? null,
            contract_id: exp.contractId ?? null,
            document_id: exp.documentId ?? null,
            descripcion: exp.descripcion ?? null,
            region: exp.region ?? 'VE',
            created_by: user.id,
            updated_at: new Date().toISOString(),
        };

        const { error } = isNew
            ? await supabase.from('expedientes').insert(dbData)
            : await supabase.from('expedientes').update(dbData).eq('id', id!).eq('organization_id', user.organizationId);

        if (error) throw new Error(`Error al guardar expediente: ${error.message}`);

        // Auditoría
        await auditService.log({
            entityType: 'contract', 
            entityId: id!,
            action: isNew ? 'create' : 'update',
            details: { module: 'expedientes', titulo: exp.titulo, status: exp.status },
            userId: user.id,
            organizationId: user.organizationId,
        });

        return id!;
    },

    async updateStatus(id: string, status: Expediente['status']): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase
            .from('expedientes')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('organization_id', user.organizationId);
            
        if (error) throw new Error(error.message);
        await auditService.log({
            entityType: 'contract',
            entityId: id,
            action: 'status_change' as any,
            details: { module: 'expedientes', newStatus: status },
            userId: user.id,
            organizationId: user.organizationId,
        });
    },

    async delete(id: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase
            .from('expedientes')
            .delete()
            .eq('id', id)
            .eq('organization_id', user.organizationId);
        if (error) throw new Error(error.message);
    },

    // ── Estadísticas dashboard ───────────────────────────────────────────────

    async getStats(): Promise<{
        total: number; activos: number; ganados: number; perdidos: number;
        cuantiaTotal: number; proximas7dias: number;
    }> {
        const user = authService.getCurrentUser();
        if (!user) return { total: 0, activos: 0, ganados: 0, perdidos: 0, cuantiaTotal: 0, proximas7dias: 0 };

        const [expsRes, audRes] = await Promise.all([
            supabase.from('expedientes')
                .select('status,cuantia,currency')
                .eq('organization_id', user.organizationId),
            supabase.from('audiencias')
                .select('id')
                .eq('organization_id', user.organizationId)
                .eq('status', 'PENDIENTE')
                .gte('fecha_hora', new Date().toISOString())
                .lte('fecha_hora', new Date(Date.now() + 7 * 24 * 3600000).toISOString()),
        ]);

        const exps = expsRes.data ?? [];
        return {
            total: exps.length,
            activos: exps.filter(e => e.status === 'ACTIVO').length,
            ganados: exps.filter(e => e.status === 'GANADO').length,
            perdidos: exps.filter(e => e.status === 'PERDIDO').length,
            cuantiaTotal: exps.reduce((s, e) => s + Number(e.cuantia ?? 0), 0),
            proximas7dias: audRes.data?.length ?? 0,
        };
    },

    // ── Actuaciones ──────────────────────────────────────────────────────────

    async getActuaciones(expedienteId: string): Promise<Actuacion[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('actuaciones')
            .select('*')
            .eq('expediente_id', expedienteId)
            .eq('organization_id', user.organizationId)
            .order('fecha', { ascending: false });
        if (error) return [];
        return (data ?? []).map(mapActuacion);
    },

    async saveActuacion(act: Omit<Actuacion, 'id' | 'createdAt'>): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase.from('actuaciones').insert({
            expediente_id: act.expedienteId,
            organization_id: act.organizationId || user.organizationId,
            fecha: act.fecha,
            tipo: act.tipo,
            descripcion: act.descripcion,
            resultado: act.resultado ?? null,
            proximo_paso: act.proximoPaso ?? null,
            status: act.status || 'REALIZADA',
            created_by: user.id,
        });
        if (error) throw new Error(`Error al guardar actuación: ${error.message}`);
    },

    async deleteActuacion(id: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase
            .from('actuaciones')
            .delete()
            .eq('id', id)
            .eq('organization_id', user.organizationId);
        if (error) throw new Error(error.message);
    },

    async updateActuacion(id: string, act: Partial<Actuacion>): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase.from('actuaciones').update({
            fecha: act.fecha,
            tipo: act.tipo,
            descripcion: act.descripcion,
            resultado: act.resultado ?? null,
            proximo_paso: act.proximoPaso ?? null,
            status: act.status || 'REALIZADA',
        }).eq('id', id).eq('organization_id', user.organizationId);
        if (error) throw new Error(`Error al actualizar actuación: ${error.message}`);
    },

    // ── Audiencias ───────────────────────────────────────────────────────────

    async getAudiencias(expedienteId: string): Promise<Audiencia[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('audiencias')
            .select('*')
            .eq('expediente_id', expedienteId)
            .eq('organization_id', user.organizationId)
            .order('fecha_hora', { ascending: true });
        if (error) return [];
        return (data ?? []).map(mapAudiencia);
    },

    async saveAudiencia(aud: Omit<Audiencia, 'id' | 'alertaEnviada' | 'createdAt'>): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase.from('audiencias').insert({
            expediente_id: aud.expedienteId,
            organization_id: aud.organizationId || user.organizationId,
            fecha_hora: aud.fechaHora,
            tribunal: aud.tribunal ?? null,
            sala: aud.sala ?? null,
            tipo: aud.tipo,
            descripcion: aud.descripcion ?? null,
            dias_alerta: aud.diasAlerta ?? 3,
            status: aud.status,
        });
        if (error) throw new Error(`Error al guardar audiencia: ${error.message}`);
    },

    async updateAudiencia(id: string, aud: Partial<Audiencia>): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase.from('audiencias').update({
            fecha_hora: aud.fechaHora,
            tribunal: aud.tribunal ?? null,
            sala: aud.sala ?? null,
            tipo: aud.tipo,
            descripcion: aud.descripcion ?? null,
            resultado: aud.resultado ?? null,
            dias_alerta: aud.diasAlerta ?? 3,
            status: aud.status,
        }).eq('id', id).eq('organization_id', user.organizationId);
        if (error) throw new Error(`Error al actualizar audiencia: ${error.message}`);
    },

    async updateAudienciaStatus(id: string, status: Audiencia['status'], resultado?: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase
            .from('audiencias')
            .update({ status, resultado: resultado ?? null })
            .eq('id', id)
            .eq('organization_id', user.organizationId);
        if (error) throw new Error(error.message);
    },

    async deleteAudiencia(id: string): Promise<void> {
        const user = authService.getCurrentUser();
        if (!user) return;

        const { error } = await supabase
            .from('audiencias')
            .delete()
            .eq('id', id)
            .eq('organization_id', user.organizationId);
        if (error) throw new Error(error.message);
    },

    // ── Próximas audiencias globales ─────────────────────────────────────────

    async getProximasAudiencias(days: number = 30): Promise<Audiencia[]> {
        const user = authService.getCurrentUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('audiencias')
            .select('*')
            .eq('organization_id', user.organizationId)
            .eq('status', 'PENDIENTE')
            .gte('fecha_hora', new Date().toISOString())
            .lte('fecha_hora', new Date(Date.now() + days * 24 * 3600000).toISOString())
            .order('fecha_hora', { ascending: true });
        if (error) return [];
        return (data ?? []).map(mapAudiencia);
    },
};
