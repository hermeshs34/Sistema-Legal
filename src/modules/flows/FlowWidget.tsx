import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, RefreshCw, SkipForward } from 'lucide-react';
import {
    flowService, TASK_STATUS_CONFIG, FLOW_STATUS_CONFIG,
    type FlowInstance, type FlowTemplate, type FlowTask, type TaskStatus
} from './flow.service.ts';
import { authService } from '../../core/auth.service.ts';
import type { TipoProceso } from '../expedientes/types.ts';

interface FlowWidgetProps {
    expedienteId: string;
    organizationId: string;
    processType: TipoProceso;
    onSyncActuacion?: (taskName: string, date: string) => void;
}

export const FlowWidget: React.FC<FlowWidgetProps> = ({ expedienteId, organizationId, processType, onSyncActuacion }) => {
    const user = authService.getCurrentUser();
    const canEdit = user?.role === 'consultor_general' || user?.role === 'abogado_senior';

    const [instance, setInstance] = useState<FlowInstance | null>(null);
    const [templates, setTemplates] = useState<FlowTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('');
    const [noteModal, setNoteModal] = useState<{ taskId: string; note: string } | null>(null);
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; due_date: string; status: TaskStatus }>({ name: '', due_date: '', status: 'PENDING' });

    const load = async () => {
        setLoading(true);
        try {
            const [inst, tpls] = await Promise.all([
                flowService.getInstance(expedienteId),
                flowService.getTemplates(processType),
            ]);
            setInstance(inst);
            setTemplates(tpls);
            if (tpls.length > 0 && !selectedTemplate) setSelectedTemplate(tpls[0].id);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [expedienteId]);

    const handleStart = async () => {
        if (!selectedTemplate) return;
        setSaving('start');
        try {
            await flowService.startFlow(expedienteId, selectedTemplate, organizationId);
            await load();
        } finally {
            setSaving(null);
        }
    };

    const handleTaskAction = async (task: FlowTask, status: TaskStatus) => {
        setSaving(task.id);
        try {
            await flowService.updateTaskStatus(task.id, status, noteModal?.note);
            if (status === 'COMPLETED') {
                if (instance) await flowService.activateNextTask(instance.id, task.stage_id);
                // Sincronización automática con historial de actuaciones
                if (onSyncActuacion && window.confirm(`¿Deseas registrar "${task.name}" automáticamente en el historial de actuaciones?`)) {
                    onSyncActuacion(task.name, new Date().toISOString().split('T')[0]);
                }
            }
            setNoteModal(null);
            await load();
        } finally {
            setSaving(null);
        }
    };

    const handleEditTask = (task: FlowTask) => {
        setEditingTaskId(task.id);
        setEditForm({ 
            name: task.name, 
            due_date: task.due_date ? task.due_date.split('T')[0] : '',
            status: task.status
        });
    };

    const saveTaskAdjustment = async () => {
        if (!editingTaskId) return;
        setSaving(editingTaskId);
        try {
            await flowService.updateTaskDetails(editingTaskId, editForm.name, editForm.due_date, editForm.status);
            
            // Si el usuario marcó como completado manualmente, ofrecer sincronización
            if (editForm.status === 'COMPLETED' && onSyncActuacion) {
                if (window.confirm(`¿Deseas registrar este hito finalizado en el historial de actuaciones?`)) {
                    onSyncActuacion(editForm.name, new Date().toISOString().split('T')[0]);
                }
            }
            
            setEditingTaskId(null);
            await load();
        } finally {
            setSaving(null);
        }
    };

    if (loading) return (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Cargando flujo procesal...</p>
        </div>
    );

    // ── Sin flujo activo ── Selector de plantilla ──────────────────────────
    if (!instance) return (
        <div>
            <div style={{ textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚖️</div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                    Sin flujo procesal activo
                </h3>
                <p style={{ margin: '0 0 1.5rem', fontSize: '0.83rem', color: '#64748b' }}>
                    Selecciona una plantilla para iniciar el seguimiento estructurado del proceso
                </p>
                {canEdit && templates.length > 0 ? (
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <select
                            value={selectedTemplate}
                            onChange={e => setSelectedTemplate(e.target.value)}
                            style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', background: '#fff', minWidth: '220px' }}
                        >
                            {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={handleStart}
                            disabled={saving === 'start'}
                            style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        >
                            <Play size={14} /> Iniciar Flujo
                        </button>
                    </div>
                ) : (
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No hay plantillas disponibles para {processType}</p>
                )}
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    const tasks = instance.tasks || [];
    const stages = instance.stages || [];
    const progress = flowService.calcularProgreso(tasks);

    return (
        <div>
            {/* ── Header del flujo ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{instance.template?.name}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: FLOW_STATUS_CONFIG[instance.status].color, background: FLOW_STATUS_CONFIG[instance.status].bg, padding: '2px 8px', borderRadius: '9px' }}>
                            {FLOW_STATUS_CONFIG[instance.status].label}
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                        Iniciado: {new Date(instance.started_at).toLocaleDateString('es-VE')}
                    </p>
                </div>
                <button onClick={load} style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <RefreshCw size={12} /> Actualizar
                </button>
            </div>

            {/* ── Barra de progreso global ── */}
            <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Progreso del proceso</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#4f46e5' }}>{progress.porcentaje}%</span>
                </div>
                <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '9px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                    <div style={{ height: '100%', width: `${progress.porcentaje}%`, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderRadius: '9px', transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {[
                        { label: 'Completadas', value: progress.completadas, color: '#166534' },
                        { label: 'En proceso',  value: progress.enProceso,  color: '#1d4ed8' },
                        { label: 'Pendientes',  value: progress.pendientes, color: '#475569' },
                        { label: 'Vencidas',    value: progress.vencidas,   color: '#991b1b' },
                    ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                            <span style={{ fontSize: '0.72rem', color: s.color, fontWeight: 700 }}>{s.value} {s.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Stepper visual ── */}
            <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.25rem', gap: '0' }}>
                {stages.map((stage, idx) => {
                    const task = tasks.find(t => t.stage_id === stage.id);
                    const isCurrent = instance.current_stage_id === stage.id;
                    const isDone = task?.status === 'COMPLETED' || task?.status === 'SKIPPED';
                    const isOverdue = task?.status === 'OVERDUE';
                    const bgColor = isDone ? '#4f46e5' : isCurrent ? stage.color : '#e2e8f0';
                    return (
                        <React.Fragment key={stage.id}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: isOverdue ? '#dc2626' : bgColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, border: isCurrent ? `3px solid ${stage.color}` : 'none', boxShadow: isCurrent ? `0 0 0 3px ${stage.color}30` : 'none' }}>
                                    {isDone ? '✓' : isOverdue ? '!' : stage.stage_order}
                                </div>
                                <span style={{ fontSize: '0.6rem', color: isDone ? '#4f46e5' : isCurrent ? '#1e293b' : '#94a3b8', fontWeight: isCurrent ? 800 : 500, marginTop: '0.25rem', textAlign: 'center', maxWidth: '55px', lineHeight: 1.2 }}>
                                    {stage.icon} {stage.name.split(' ').slice(0, 2).join(' ')}
                                </span>
                            </div>
                            {idx < stages.length - 1 && (
                                <div style={{ flex: 1, height: 2, background: isDone ? '#4f46e5' : '#e2e8f0', minWidth: '12px', marginTop: '-12px' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* ── Lista de tareas ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {stages.map(stage => {
                    const task = tasks.find(t => t.stage_id === stage.id);
                    if (!task) return null;
                    const cfg = TASK_STATUS_CONFIG[task.status];
                    const isCurrent = instance.current_stage_id === stage.id;

                    return (
                        <div key={stage.id} style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${isCurrent ? stage.color + '60' : '#e2e8f0'}`, overflow: 'hidden', boxShadow: isCurrent ? `0 2px 12px ${stage.color}20` : 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1rem', gap: '0.75rem' }}>
                                {/* Número e icono */}
                                <div style={{ width: 36, height: 36, borderRadius: '10px', background: task.status === 'COMPLETED' ? '#f0fdf4' : isCurrent ? `${stage.color}15` : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                                    {task.status === 'COMPLETED' ? '✅' : task.status === 'OVERDUE' ? '🚨' : stage.icon}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem', flexWrap: 'wrap' }}>
                                        {editingTaskId === task.id ? (
                                            <input 
                                                style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', border: '1px solid #4f46e5', borderRadius: '4px', padding: '2px 6px', width: '250px' }} 
                                                value={editForm.name} 
                                                onChange={e => setEditForm({...editForm, name: e.target.value})}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 800 : 800, color: '#1e293b' }}>{stage.stage_order}. {task.name}</span>
                                        )}
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '1px 7px', borderRadius: '9px' }}>
                                            {cfg.emoji} {cfg.label}
                                        </span>
                                        {isCurrent && <span style={{ fontSize: '0.65rem', color: stage.color, fontWeight: 800 }}>← ETAPA ACTUAL</span>}
                                        {canEdit && editingTaskId !== task.id && (
                                            <button onClick={() => handleEditTask(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                                                <Play size={10} style={{ transform: 'rotate(90deg)' }} /> 
                                            </button>
                                        )}
                                    </div>
                                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: '#94a3b8', alignItems: 'center' }}>
                                            {stage.responsible_role && <span>👤 {stage.responsible_role}</span>}
                                            {editingTaskId === task.id ? (
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        📅 <input type="date" style={{ fontSize: '0.7rem', border: '1px solid #4f46e5', borderRadius: '4px', padding: '1px 4px' }} value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} />
                                                    </span>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        🟢 <select 
                                                                style={{ fontSize: '0.7rem', border: '1px solid #4f46e5', borderRadius: '4px', padding: '1px 4px' }}
                                                                value={editForm.status}
                                                                onChange={e => setEditForm({...editForm, status: e.target.value as TaskStatus})}
                                                            >
                                                            {Object.entries(TASK_STATUS_CONFIG).map(([val, cfg]) => (
                                                                <option key={val} value={val}>{cfg.emoji} {cfg.label}</option>
                                                            ))}
                                                        </select>
                                                    </span>
                                                </div>
                                            ) : (
                                                task.due_date && <span>📅 Límite: {new Date(task.due_date).toLocaleDateString('es-VE')}</span>
                                            )}
                                        </div>
                                </div>

                                {/* Acciones */}
                                {canEdit && task.status !== 'COMPLETED' && task.status !== 'SKIPPED' && (
                                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                        {editingTaskId === task.id ? (
                                            <>
                                                <button onClick={saveTaskAdjustment} style={{ padding: '0.5rem', borderRadius: '8px', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer' }}><CheckCircle size={14} /></button>
                                                <button onClick={() => setEditingTaskId(null)} style={{ padding: '0.5rem', borderRadius: '8px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}>X</button>
                                            </>
                                        ) : (
                                            <>
                                                {(task.status === 'IN_PROGRESS' || task.status === 'OVERDUE') && (
                                                    <button
                                                        onClick={() => handleTaskAction(task, 'COMPLETED')}
                                                        disabled={saving === task.id}
                                                        title="Marcar como completada"
                                                        style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none', background: '#166534', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                                    >
                                                        {saving === task.id ? <RefreshCw size={12} /> : <CheckCircle size={12} />} Completar
                                                    </button>
                                                )}
                                                {task.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleTaskAction(task, 'IN_PROGRESS')}
                                                        disabled={saving === task.id}
                                                        title="Iniciar esta tarea"
                                                        style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: 'none', background: '#1d4ed8', color: 'white', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                                    >
                                                        <Play size={12} /> Iniciar
                                                    </button>
                                                )}
                                                {!stage.is_mandatory && (
                                                    <button
                                                        onClick={() => handleTaskAction(task, 'SKIPPED')}
                                                        title="Omitir etapa"
                                                        style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', opacity: 0.6 }}
                                                    >
                                                        <SkipForward size={13} color="#475569" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                                {task.status === 'COMPLETED' && (
                                    <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>
                                        {task.completed_at ? new Date(task.completed_at).toLocaleDateString('es-VE') : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Botón completar proceso */}
            {progress.porcentaje === 100 && instance.status === 'ACTIVE' && canEdit && (
                <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                    <button
                        onClick={async () => { await flowService.updateInstanceStatus(instance.id, 'COMPLETED'); await load(); }}
                        style={{ padding: '0.75rem 2rem', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #166534, #15803d)', color: 'white', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <CheckCircle size={16} /> Cerrar Flujo Procesal
                    </button>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
