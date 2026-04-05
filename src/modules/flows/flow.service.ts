import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';
import type { TipoProceso as ExpedienteProcessType } from '../expedientes/types.ts';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export type FlowStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'OVERDUE';
export type ProcessType = ExpedienteProcessType;

export interface FlowTemplate {
    id: string;
    code: string;
    name: string;
    description?: string;
    process_type: ProcessType;
    jurisdiction: string;
    is_active: boolean;
    is_system: boolean;
    organization_id?: string;
}

export interface FlowStage {
    id: string;
    template_id: string;
    stage_order: number;
    name: string;
    description?: string;
    responsible_role?: string;
    days_limit?: number;
    alert_days: number;
    is_mandatory: boolean;
    auto_next: boolean;
    color: string;
    icon: string;
}

export interface FlowInstance {
    id: string;
    expediente_id: string;
    template_id: string;
    current_stage_id?: string;
    status: FlowStatus;
    started_at: string;
    completed_at?: string;
    organization_id: string;
    template?: FlowTemplate;
    stages?: FlowStage[];
    tasks?: FlowTask[];
}

export interface FlowTask {
    id: string;
    instance_id: string;
    stage_id: string;
    expediente_id: string;
    name: string;
    description?: string;
    status: TaskStatus;
    due_date?: string;
    completed_at?: string;
    completed_by?: string;
    notes?: string;
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; emoji: string }> = {
    PENDING:     { label: 'Pendiente',    color: '#475569', bg: '#f8fafc', emoji: '⏳' },
    IN_PROGRESS: { label: 'En proceso',   color: '#1d4ed8', bg: '#eff6ff', emoji: '🔄' },
    COMPLETED:   { label: 'Completada',   color: '#166534', bg: '#f0fdf4', emoji: '✅' },
    SKIPPED:     { label: 'Omitida',      color: '#92400e', bg: '#fffbeb', emoji: '⏭️' },
    OVERDUE:     { label: 'Vencida',      color: '#991b1b', bg: '#fef2f2', emoji: '🚨' },
};

export const FLOW_STATUS_CONFIG: Record<FlowStatus, { label: string; color: string; bg: string }> = {
    ACTIVE:    { label: 'Activo',     color: '#166534', bg: '#f0fdf4' },
    PAUSED:    { label: 'Pausado',    color: '#92400e', bg: '#fffbeb' },
    COMPLETED: { label: 'Completado', color: '#1d4ed8', bg: '#eff6ff' },
    CANCELLED: { label: 'Cancelado',  color: '#991b1b', bg: '#fef2f2' },
};

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO
// ═══════════════════════════════════════════════════════════════════════════

export const flowService = {

    // ── Obtener plantillas disponibles ───────────────────────────────────
    async getTemplates(processType?: ProcessType): Promise<FlowTemplate[]> {
        let q = supabase
            .from('legal_flow_templates')
            .select('*')
            .eq('is_active', true)
            .order('process_type');

        if (processType) q = q.eq('process_type', processType);

        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },

    // ── Obtener etapas de una plantilla ──────────────────────────────────
    async getStages(templateId: string): Promise<FlowStage[]> {
        const { data, error } = await supabase
            .from('legal_flow_stages')
            .select('*')
            .eq('template_id', templateId)
            .order('stage_order');
        if (error) throw error;
        return data || [];
    },

    // ── Obtener instancia activa de un expediente ─────────────────────────
    async getInstance(expedienteId: string): Promise<FlowInstance | null> {
        const { data } = await supabase
            .from('expediente_flow_instances')
            .select('*')
            .eq('expediente_id', expedienteId)
            .eq('status', 'ACTIVE')
            .single();

        if (!data) return null;

        const [template, stages, tasks] = await Promise.all([
            supabase.from('legal_flow_templates').select('*').eq('id', data.template_id).single().then(r => r.data),
            this.getStages(data.template_id),
            this.getTasks(data.id),
        ]);

        return { ...data, template, stages, tasks };
    },

    // ── Obtener tareas de una instancia ───────────────────────────────────
    async getTasks(instanceId: string): Promise<FlowTask[]> {
        const { data } = await supabase
            .from('expediente_flow_tasks')
            .select('*')
            .eq('instance_id', instanceId)
            .order('created_at');
        return data || [];
    },

    // ── Iniciar un flujo en un expediente ────────────────────────────────
    async startFlow(expedienteId: string, templateId: string, orgId: string): Promise<FlowInstance> {
        const user = authService.getCurrentUser();
        if (!user) throw new Error('No autenticado');

        const stages = await this.getStages(templateId);
        const firstStage = stages[0];

        // Crear instancia
        const { data: instance, error } = await supabase
            .from('expediente_flow_instances')
            .insert({
                expediente_id: expedienteId,
                template_id: templateId,
                current_stage_id: firstStage?.id,
                status: 'ACTIVE',
                organization_id: orgId,
                created_by: user.id,
            })
            .select()
            .single();

        if (error) throw error;

        // Crear tareas para todas las etapas
        const hoy = new Date();
        const tasks = stages.map(s => {
            const due = s.days_limit
                ? new Date(hoy.getTime() + s.days_limit * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                : undefined;
            return {
                instance_id: instance.id,
                stage_id: s.id,
                expediente_id: expedienteId,
                name: s.name,
                description: s.description,
                status: s.stage_order === 1 ? 'IN_PROGRESS' : 'PENDING',
                due_date: due,
                organization_id: orgId,
            };
        });

        await supabase.from('expediente_flow_tasks').insert(tasks);

        return { ...instance, stages, tasks: [] };
    },

    // ── Avanzar tarea a siguiente estado ─────────────────────────────────
    async updateTaskDetails(taskId: string, name: string, dueDate: string, status?: TaskStatus): Promise<void> {
        const updates: any = {
            name,
            due_date: dueDate || null
        };
        if (status) updates.status = status;
        
        const { error } = await supabase.from('expediente_flow_tasks').update(updates).eq('id', taskId);
        if (error) throw new Error(`Error updating task details: ${error.message}`);
    },

    async updateTaskStatus(taskId: string, status: TaskStatus, notes?: string): Promise<void> {
        const user = authService.getCurrentUser();
        const updates: any = {
            status,
            updated_at: new Date().toISOString(),
        };
        if (status === 'COMPLETED') {
            updates.completed_at = new Date().toISOString();
            updates.completed_by = user?.id;
        }
        if (notes) updates.notes = notes;

        await supabase.from('expediente_flow_tasks').update(updates).eq('id', taskId);
    },

    // ── Cambiar estado de una instancia ───────────────────────────────────
    async updateInstanceStatus(instanceId: string, status: FlowStatus): Promise<void> {
        const updates: any = { status, updated_at: new Date().toISOString() };
        if (status === 'COMPLETED') updates.completed_at = new Date().toISOString();
        await supabase.from('expediente_flow_instances').update(updates).eq('id', instanceId);
    },

    // ── Calcular progreso del flujo ───────────────────────────────────────
    calcularProgreso(tasks: FlowTask[]): {
        total: number;
        completadas: number;
        enProceso: number;
        pendientes: number;
        vencidas: number;
        porcentaje: number;
    } {
        const total = tasks.length;
        const completadas = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'SKIPPED').length;
        const enProceso = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const vencidas = tasks.filter(t => t.status === 'OVERDUE').length;
        const pendientes = tasks.filter(t => t.status === 'PENDING').length;
        return {
            total, completadas, enProceso, pendientes, vencidas,
            porcentaje: total > 0 ? Math.round((completadas / total) * 100) : 0,
        };
    },

    // ── Verificar y marcar tareas vencidas ───────────────────────────────
    async checkOverdueTasks(instanceId: string): Promise<void> {
        const hoy = new Date().toISOString().split('T')[0];
        await supabase
            .from('expediente_flow_tasks')
            .update({ status: 'OVERDUE', updated_at: new Date().toISOString() })
            .eq('instance_id', instanceId)
            .eq('status', 'PENDING')
            .lt('due_date', hoy);
    },

    // ── Activar la siguiente tarea al completar una ───────────────────────
    async activateNextTask(instanceId: string, completedStageId: string): Promise<void> {
        // Obtener la etapa completada para saber su order
        const { data: completedStage } = await supabase
            .from('legal_flow_stages')
            .select('stage_order, template_id')
            .eq('id', completedStageId)
            .single();

        if (!completedStage) return;

        // Buscar la siguiente etapa en la plantilla
        const { data: nextStage } = await supabase
            .from('legal_flow_stages')
            .select('id')
            .eq('template_id', completedStage.template_id)
            .eq('stage_order', completedStage.stage_order + 1)
            .single();

        if (!nextStage) return;

        // Activar la tarea de la siguiente etapa
        await supabase
            .from('expediente_flow_tasks')
            .update({ status: 'IN_PROGRESS', updated_at: new Date().toISOString() })
            .eq('instance_id', instanceId)
            .eq('stage_id', nextStage.id)
            .eq('status', 'PENDING');

        // Actualizar current_stage_id en la instancia
        await supabase
            .from('expediente_flow_instances')
            .update({ current_stage_id: nextStage.id, updated_at: new Date().toISOString() })
            .eq('id', instanceId);
    },

    // ── Gestión de Plantillas (Admin) ────────────────────────────────────
    async saveTemplate(template: Partial<FlowTemplate>): Promise<FlowTemplate> {
        const user = authService.getCurrentUser();
        const payload = {
            ...template,
            organization_id: template.organization_id || user?.organizationId,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('legal_flow_templates')
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteTemplate(id: string): Promise<void> {
        const { error } = await supabase
            .from('legal_flow_templates')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ── Gestión de Etapas (Admin) ────────────────────────────────────────
    async saveStage(stage: Partial<FlowStage>): Promise<FlowStage> {
        const { data, error } = await supabase
            .from('legal_flow_stages')
            .upsert(stage)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteStage(id: string): Promise<void> {
        const { error } = await supabase
            .from('legal_flow_stages')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async reorderStages(templateId: string, stageIds: string[]): Promise<void> {
        const updates = stageIds.map((id, index) => ({
            id,
            template_id: templateId,
            stage_order: index + 1,
        }));

        const { error } = await supabase
            .from('legal_flow_stages')
            .upsert(updates);
        
        if (error) throw error;
    },
};
