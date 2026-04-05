import React, { useState, useEffect } from 'react';
import { 
    GitBranch, Plus, Search, Edit2, Trash2, ChevronRight, 
    Settings, RefreshCw, X
} from 'lucide-react';
import { flowService, type FlowTemplate, type FlowStage, type ProcessType } from './flow.service.ts';
import { authService } from '../../core/auth.service.ts';

const PROCESS_COLORS: Record<ProcessType, string> = {
    CIVIL: '#6366f1',
    LABORAL: '#7c3aed',
    PENAL: '#dc2626',
    MERCANTIL: '#ea580c'
};

export const FlowsAdminView: React.FC = () => {
    const user = authService.getCurrentUser();
    const canEdit = user?.role === 'consultor_general';

    const [templates, setTemplates] = useState<FlowTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);
    const [stages, setStages] = useState<FlowStage[]>([]);
    const [loadingStages, setLoadingStages] = useState(false);

    // Modales
    const [showTplForm, setShowTplForm] = useState(false);
    const [tplForm, setTplForm] = useState<Partial<FlowTemplate>>({ name: '', code: '', process_type: 'CIVIL', jurisdiction: 'VE' });
    const [showStageForm, setShowStageForm] = useState(false);
    const [stageForm, setStageForm] = useState<Partial<FlowStage>>({ name: '', icon: '📋', color: '#6366f1', stage_order: 1, is_mandatory: true, auto_next: false, alert_days: 3 });
    const [saving, setSaving] = useState(false);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await flowService.getTemplates();
            setTemplates(data);
            if (selectedTemplate) {
                const refreshed = data.find(t => t.id === selectedTemplate.id);
                if (refreshed) setSelectedTemplate(refreshed);
            }
        } finally {
            setLoading(false);
        }
    };

    const loadStages = async (tplId: string) => {
        setLoadingStages(true);
        try {
            const data = await flowService.getStages(tplId);
            setStages(data);
        } finally {
            setLoadingStages(false);
        }
    };

    useEffect(() => { loadTemplates(); }, []);

    const handleSelectTemplate = async (tpl: FlowTemplate) => {
        setSelectedTemplate(tpl);
        await loadStages(tpl.id);
    };

    const handleSaveTemplate = async () => {
        if (!tplForm.name || !tplForm.code) return;
        setSaving(true);
        try {
            const saved = await flowService.saveTemplate(tplForm);
            await loadTemplates();
            setSelectedTemplate(saved);
            setShowTplForm(false);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setSaving(false); }
    };

    const handleSaveStage = async () => {
        if (!stageForm.name || !selectedTemplate) return;
        setSaving(true);
        try {
            await flowService.saveStage({ ...stageForm, template_id: selectedTemplate.id });
            await loadStages(selectedTemplate.id);
            setShowStageForm(false);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setSaving(false); }
    };

    const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('¿Eliminar esta plantilla? Se perderán todas sus etapas.')) return;
        try {
            await flowService.deleteTemplate(id);
            if (selectedTemplate?.id === id) setSelectedTemplate(null);
            await loadTemplates();
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const handleDeleteStage = async (id: string) => {
        if (!window.confirm('¿Eliminar esta etapa?')) return;
        try {
            await flowService.deleteStage(id);
            if (selectedTemplate) await loadStages(selectedTemplate.id);
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const filtered = templates.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <GitBranch size={22} color="white" />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>Gestión de Flujos Legales (BPM)</h1>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Parametrización de etapas procesales y flujos de trabajo estructurados</p>
                        </div>
                    </div>
                </div>
                {canEdit && (
                    <button 
                        onClick={() => { setTplForm({ name: '', code: '', process_type: 'CIVIL', jurisdiction: 'VE' }); setShowTplForm(true); }}
                        style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4f46e5, #0ea5e9)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'white', fontWeight: 700 }}
                    >
                        <Plus size={16} /> Nueva Plantilla
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                
                {/* ── Lista de Plantillas ── */}
                <div>
                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar plantillas corporativas..." style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {loading && !templates.length ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}><RefreshCw size={24} className="animate-spin" color="#94a3b8" /></div>
                        ) : filtered.map(t => (
                            <div 
                                key={t.id} 
                                onClick={() => handleSelectTemplate(t)}
                                style={{ 
                                    padding: '1rem', borderRadius: '14px', background: '#fff', 
                                    border: `2px solid ${selectedTemplate?.id === t.id ? '#4f46e5' : '#e2e8f0'}`,
                                    cursor: 'pointer', transition: 'all 0.2s', position: 'relative',
                                    boxShadow: selectedTemplate?.id === t.id ? '0 4px 12px rgba(79, 70, 229, 0.1)' : 'none'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'white', background: PROCESS_COLORS[t.process_type], padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>{t.process_type}</span>
                                    {!t.is_system && canEdit && (
                                        <Trash2 size={13} color="#94a3b8" onClick={(e) => handleDeleteTemplate(t.id, e)} />
                                    )}
                                </div>
                                <h4 style={{ margin: '0.5rem 0 0.25rem', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>{t.name}</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <code style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{t.code}</code>
                                    <ChevronRight size={16} color={selectedTemplate?.id === t.id ? '#4f46e5' : '#94a3b8'} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Detalle de Etapas ── */}
                <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '2rem', minHeight: '500px' }}>
                    {!selectedTemplate ? (
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                            <Settings size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p style={{ fontSize: '0.9rem' }}>Selecciona una plantilla para ver sus etapas y tareas</p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#1e293b' }}>
                                        {selectedTemplate.name} {selectedTemplate.is_system && <span title="Plantilla base del sistema" style={{ opacity: 0.5 }}>🔒</span>}
                                    </h2>
                                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>Secuencia de {stages.length} etapas críticas</p>
                                </div>
                                {canEdit && (
                                    <button 
                                        onClick={() => { setTplForm(selectedTemplate); setShowTplForm(true); }}
                                        style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                    >
                                        <Edit2 size={14} /> {selectedTemplate.is_system ? 'Modificar Base' : 'Editar Flujo'}
                                    </button>
                                )}
                            </div>

                            {loadingStages ? (
                                <div style={{ textAlign: 'center', padding: '4rem' }}><RefreshCw size={32} className="animate-spin" color="#94a3b8" /></div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {stages.map((stage, idx) => (
                                        <div key={stage.id} style={{ display: 'flex', gap: '1.25rem' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${stage.color}15`, color: stage.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, flexShrink: 0 }}>{stage.icon}</div>
                                                {idx < stages.length - 1 && <div style={{ width: '2px', flex: 1, background: '#e2e8f0', margin: '4px 0' }} />}
                                            </div>
                                            <div style={{ flex: 1, paddingBottom: idx < stages.length - 1 ? '1.5rem' : '0' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{idx + 1}. {stage.name}</h4>
                                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>{stage.description}</p>
                                                    </div>
                                                    {canEdit && (
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <button onClick={() => { setStageForm(stage); setShowStageForm(true); }} style={{ height: '30px', width: '30px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', cursor: 'pointer' }}><Edit2 size={12}/></button>
                                                            <button onClick={() => handleDeleteStage(stage.id)} style={{ height: '30px', width: '30px', borderRadius: '6px', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', cursor: 'pointer' }}><Trash2 size={12} color="#dc2626"/></button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {canEdit && (
                                        <button 
                                            onClick={() => { setStageForm({ name: '', stage_order: stages.length + 1, icon: '📋', color: '#6366f1', is_mandatory: true, alert_days: 3 }); setShowStageForm(true); }}
                                            style={{ padding: '0.75rem', borderRadius: '12px', border: '2px dashed #e2e8f0', background: 'transparent', color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                        >
                                            <Plus size={16} /> Añadir Etapa
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal Plantilla ── */}
            {showTplForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '450px', maxWidth: '100%', overflow: 'hidden' }}>
                        <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{tplForm.id ? 'Editar Plantilla' : 'Nueva Plantilla'}</h3>
                            <X size={20} color="#94a3b8" cursor="pointer" onClick={() => setShowTplForm(false)} />
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>NOMBRE DE LA PLANTILLA</label>
                                <input value={tplForm.name} onChange={e => setTplForm({...tplForm, name: e.target.value})} style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>CÓDIGO ÚNICO</label>
                                <input value={tplForm.code} disabled={!!tplForm.id} onChange={e => setTplForm({...tplForm, code: e.target.value})} style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>TIPO PROCESO</label>
                                    <select value={tplForm.process_type} onChange={e => setTplForm({...tplForm, process_type: e.target.value as any})} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <option value="CIVIL">Civil</option>
                                        <option value="LABORAL">Laboral</option>
                                        <option value="PENAL">Penal</option>
                                        <option value="MERCANTIL">Mercantil</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#64748b', marginBottom: '0.4rem' }}>JURISDICCIÓN</label>
                                    <input value={tplForm.jurisdiction} onChange={e => setTplForm({...tplForm, jurisdiction: e.target.value})} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                            <button onClick={() => setShowTplForm(false)} style={{ padding: '0.6rem 1.25rem', border: 'none', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleSaveTemplate} disabled={saving} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: 'white', fontWeight: 700, cursor: 'pointer', marginLeft: '0.5rem' }}>{saving ? 'Guardando...' : 'Guardar Plantilla'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal Etapa ── */}
            {showStageForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '500px', maxWidth: '100%', overflow: 'hidden' }}>
                        <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{stageForm.id ? 'Editar Etapa' : 'Nueva Etapa'}</h3>
                            <X size={20} color="#94a3b8" cursor="pointer" onClick={() => setShowStageForm(false)} />
                        </div>
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>ICONO</label>
                                    <input value={stageForm.icon} onChange={e => setStageForm({...stageForm, icon: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '1.2rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>NOMBRE DE LA ETAPA</label>
                                    <input value={stageForm.name} onChange={e => setStageForm({...stageForm, name: e.target.value})} style={{ width: '100%', padding: '0.65rem 0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxSizing: 'border-box' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>DESCRIPCIÓN</label>
                                <textarea value={stageForm.description} onChange={e => setStageForm({...stageForm, description: e.target.value})} style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '60px', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>ORDEN</label>
                                    <input type="number" value={stageForm.stage_order} onChange={e => setStageForm({...stageForm, stage_order: parseInt(e.target.value)})} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>DÍAS LÍMITE</label>
                                    <input type="number" value={stageForm.days_limit || ''} onChange={e => setStageForm({...stageForm, days_limit: parseInt(e.target.value) || undefined})} placeholder="Opcional" style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.4rem' }}>ROL RESPONSABLE</label>
                                    <select value={stageForm.responsible_role} onChange={e => setStageForm({...stageForm, responsible_role: e.target.value})} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <option value="abogado_senior">Abogado Senior</option>
                                        <option value="abogado_junior">Abogado Junior</option>
                                        <option value="consultor_general">Consultor General</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={stageForm.is_mandatory} onChange={e => setStageForm({...stageForm, is_mandatory: e.target.checked})} /> Etapa Requerida
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={stageForm.auto_next} onChange={e => setStageForm({...stageForm, auto_next: e.target.checked})} /> Avance Automático
                                </label>
                            </div>
                        </div>
                        <div style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
                            <button onClick={() => setShowStageForm(false)} style={{ padding: '0.6rem 1.25rem', border: 'none', background: 'transparent', color: '#64748b', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
                            <button onClick={handleSaveStage} disabled={saving} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: 'white', fontWeight: 700, cursor: 'pointer', marginLeft: '0.5rem' }}>{saving ? 'Guardando...' : 'Guardar Etapa'}</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};
