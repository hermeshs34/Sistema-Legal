import React, { useState, useEffect, useMemo } from 'react';
import {
    Settings, Search, Plus, Edit2, Save, X, RefreshCw,
    Shield, Clock, DollarSign, Bell, Brain,
    Scale, Users, Globe, CheckCircle, Info, History, Calculator
} from 'lucide-react';
import { parametersService, type SystemParameter, type ParamCategory, type ParameterCreateInput } from './parameters.service.ts';
import { termsService } from '../shared/terms.service.ts';
import { authService } from '../../core/auth.service.ts';
import { supabase } from '../../core/supabase.ts';
import { AuditTimeline } from '../shared/AuditTimeline.tsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Configuración visual por categoría ──────────────────────────────────
const CATEGORY_CONFIG: Record<ParamCategory, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    LAPSOS:        { label: 'Lapsos Procesales',    icon: <Clock size={16} />,       color: '#7c3aed', bg: '#f5f3ff' },
    ARANCELES:     { label: 'Aranceles Judiciales', icon: <Scale size={16} />,       color: '#b45309', bg: '#fffbeb' },
    DIVISAS:       { label: 'Divisas y Tasas',      icon: <DollarSign size={16} />,  color: '#0d9488', bg: '#f0fdf4' },
    NOTIFICACIONES:{ label: 'Notificaciones',       icon: <Bell size={16} />,        color: '#1d4ed8', bg: '#eff6ff' },
    IA_CUOTAS:     { label: 'IA y Cuotas',          icon: <Brain size={16} />,       color: '#7e22ce', bg: '#faf5ff' },
    COMPLIANCE:    { label: 'Compliance',           icon: <Shield size={16} />,      color: '#166534', bg: '#f0fdf4' },
    HONORARIOS:    { label: 'Honorarios',           icon: <Users size={16} />,       color: '#92400e', bg: '#fef3c7' },
    SISTEMA:       { label: 'Sistema',              icon: <Settings size={16} />,    color: '#475569', bg: '#f8fafc' },
    CALENDARIO:    { label: 'Calendario',           icon: <Clock size={16} />,       color: '#0e7490', bg: '#ecfeff' },
};

const VALUE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
    number:   { label: 'Número',   color: '#2563eb' },
    boolean:  { label: 'Sí/No',    color: '#16a34a' },
    text:     { label: 'Texto',    color: '#64748b' },
    json:     { label: 'JSON',     color: '#9333ea' },
    date:     { label: 'Fecha',    color: '#ea580c' },
    currency: { label: 'Moneda',   color: '#0d9488' },
};

export const ParametersView: React.FC = () => {
    const user = authService.getCurrentUser();
    const canEdit = user?.role === 'consultor_general' || user?.role === 'abogado_senior';

    const [params, setParams] = useState<SystemParameter[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<ParamCategory | 'ALL'>('ALL');
    const [search, setSearch] = useState('');
    const [editingParam, setEditingParam] = useState<SystemParameter | null>(null);
    const [saving, setSaving] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newParam, setNewParam] = useState<Partial<ParameterCreateInput>>({
        category: 'SISTEMA', value_type: 'text', jurisdiction: 'ALL'
    });
    const [auditId, setAuditId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'config' | 'sandbox'>('config');
    
    // Sandbox State
    const [sandboxForm, setSandboxForm] = useState({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        days: 5,
        jurisdiction: 'VE',
        mode: 'working' as 'working' | 'calendar'
    });
    const [sandboxResult, setSandboxResult] = useState<Date | null>(null);
    const [sandboxLoading, setSandboxLoading] = useState(false);

    const handleCalculateTerm = async () => {
        setSandboxLoading(true);
        try {
            const res = await termsService.calculateDeadline(
                sandboxForm.startDate,
                sandboxForm.days,
                sandboxForm.jurisdiction,
                sandboxForm.mode
            );
            setSandboxResult(res);
        } catch (e: any) {
            alert('Error en cálculo: ' + e.message);
        } finally {
            setSandboxLoading(false);
        }
    };

    const load = async () => {
        setLoading(true);
        try {
            parametersService.invalidateCache();
            const data = await parametersService.getAll();
            setParams(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        params.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
        return counts;
    }, [params]);

    const filtered = useMemo(() => {
        return params.filter(p => {
            const matchCat = activeCategory === 'ALL' || p.category === activeCategory;
            const matchSearch = !search || [p.code, p.name, p.description, p.value]
                .some(f => f?.toLowerCase().includes(search.toLowerCase()));
            return matchCat && matchSearch;
        });
    }, [params, activeCategory, search]);

    const grouped = useMemo(() => {
        const groups: Record<string, SystemParameter[]> = {};
        filtered.forEach(p => {
            if (!groups[p.category]) groups[p.category] = [];
            groups[p.category].push(p);
        });
        return groups;
    }, [filtered]);

    const handleSave = async (p: SystemParameter) => {
        if (!p.code || !p.name || !p.value) {
            alert('Campos básicos son requeridos');
            return;
        }
        setSaving(true);
        try {
            await parametersService.update(p.id, p);
            setParams(prev => prev.map(x => x.id === p.id ? p : x));
            setEditingParam(null);
            alert('Parámetro actualizado con éxito');
        } catch (e: any) { 
            alert('Error al guardar: ' + e.message); 
        } finally { 
            setSaving(false); 
        }
    };

    const handleDelete = async (p: SystemParameter) => {
        if (!confirm(`¿Confirma eliminar el parámetro ${p.code}? Esto podría afectar a cálculos legales activos.`)) return;
        setLoading(true);
        try {
            await parametersService.deactivate(p.id);
            setParams(prev => prev.filter(x => x.id !== p.id));
            alert('Parámetro desactivado');
        } catch (e: any) { 
            alert('Error al eliminar: ' + e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleRefreshRates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('update-exchange-rates');
            if (error) throw error;
            if (data.success) {
                const finalRate = await parametersService.updateTasaBCV(data.rate);
                alert(`Tasa actualizada: ${finalRate} VES/USD`);
                await load();
            } else { throw new Error(data.error); }
        } catch (e: any) { 
            alert('Error al sincronizar con BCV: ' + e.message); 
        } finally { 
            setLoading(false); 
        }
    };

    const handleCreate = async () => {
        if (!newParam.code || !newParam.name || !newParam.value) {
            alert('Por favor complete los campos obligatorios (Código, Nombre y Valor)');
            return;
        }
        setSaving(true);
        try {
            const created = await parametersService.create(newParam as ParameterCreateInput);
            setParams(prev => [created, ...prev]);
            setShowNewForm(false);
            setNewParam({ category: 'SISTEMA', value_type: 'text', jurisdiction: 'ALL' });
            alert('Parámetro creado con éxito');
        } catch (e: any) { 
            alert('Error al crear: ' + e.message); 
        } finally { 
            setSaving(false); 
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            {/* Cabecera */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Settings size={20} color="white" />
                        </div>
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>Base Paramétrica</h1>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Motor de reglas configurables · {params.length} parámetros activos</p>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button 
                        onClick={() => setViewMode(viewMode === 'config' ? 'sandbox' : 'config')} 
                        style={{ 
                            padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #1e3a8a', 
                            background: viewMode === 'sandbox' ? '#1e3a8a' : '#fff', 
                            color: viewMode === 'sandbox' ? '#fff' : '#1e3a8a',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600 
                        }}
                    >
                        {viewMode === 'sandbox' ? <Settings size={14} /> : <Calculator size={14} />}
                        {viewMode === 'sandbox' ? 'Ver Parámetros' : 'Calibrador de Términos'}
                    </button>
                    <button onClick={() => setAuditId('ALL')} style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                        <History size={14} /> Historial Global
                    </button>
                    <button onClick={load} style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                        <RefreshCw size={14} /> Recargar
                    </button>
                    {canEdit && (
                        <button onClick={() => setShowNewForm(true)} style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'white', fontWeight: 700 }}>
                            <Plus size={14} /> Nuevo Parámetro
                        </button>
                    )}
                </div>
            </div>

            {/* Info Box */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.9rem 1.25rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '1.5rem' }}>
                <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#1e40af', lineHeight: 1.5 }}>
                    <strong>Console v2.0:</strong> Gestión total de parámetros legales. El historial global permite ver quién cambió qué en toda la organización. El icono 🔒 protege parámetros core.
                </p>
            </div>

            {/* Modals de Auditoría */}
            {auditId && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '500px', background: '#fff', height: '100%', boxShadow: '-4px 0 25px rgba(0,0,0,0.1)' }}>
                        <AuditTimeline 
                            entityType={auditId === 'ALL' ? undefined : 'system_parameters'} 
                            entityId={auditId === 'ALL' ? undefined : auditId} 
                            showClose onClose={() => setAuditId(null)} 
                        />
                    </div>
                </div>
            )}

            {/* Modal Crear */}
            {showNewForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '550px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                            <h3 style={{ margin: 0, color: 'white', fontWeight: 800 }}>Crear Nuevo Parámetro</h3>
                            <button onClick={() => setShowNewForm(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', padding: '4px', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Código (Único, Mayúsculas)</label>
                                <input placeholder="EJ: NOTIF_DELAY_SEC" value={newParam.code || ''} onChange={e => setNewParam({...newParam, code: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Nombre Descriptivo</label>
                                <input placeholder="Nombre para mostrar" value={newParam.name || ''} onChange={e => setNewParam({...newParam, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Categoría</label>
                                <select value={newParam.category} onChange={e => setNewParam({...newParam, category: e.target.value as ParamCategory})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Tipo de Valor</label>
                                <select value={newParam.value_type} onChange={e => setNewParam({...newParam, value_type: e.target.value as any})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    {Object.entries(VALUE_TYPE_BADGE).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Valor Inicial</label>
                                <input type={newParam.value_type === 'number' ? 'number' : 'text'} placeholder="Ej: 50.5 o Texto" value={newParam.value || ''} onChange={e => setNewParam({...newParam, value: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Descripción Profesional</label>
                                <textarea rows={2} placeholder="Explicación técnica del parámetro..." value={newParam.description || ''} onChange={e => setNewParam({...newParam, description: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'none' }} />
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem', background: '#f8fafc', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowNewForm(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                            <button onClick={handleCreate} disabled={saving} style={{ padding: '0.6rem 1.75rem', borderRadius: '8px', border: 'none', background: '#4f46e5', color: 'white', cursor: 'pointer', fontWeight: 800 }}>
                                {saving ? 'Creando...' : 'Crear Parámetro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Editar */}
            {editingParam && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '550px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #0f172a, #334155)' }}>
                            <h3 style={{ margin: 0, color: 'white', fontWeight: 800 }}>Editar: {editingParam.code}</h3>
                            <button onClick={() => setEditingParam(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', padding: '4px', cursor: 'pointer' }}><X size={18} /></button>
                        </div>
                        <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Código (Único, Mayúsculas)</label>
                                <input disabled={editingParam.is_system} value={editingParam.code} onChange={e => setEditingParam({...editingParam, code: e.target.value.toUpperCase()})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', opacity: editingParam.is_system ? 0.6 : 1 }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Nombre Descriptivo</label>
                                <input value={editingParam.name} onChange={e => setEditingParam({...editingParam, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Valor Actual</label>
                                <input type={editingParam.value_type === 'number' ? 'number' : 'text'} value={editingParam.value} onChange={e => setEditingParam({...editingParam, value: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '2px solid #4f46e5', fontWeight: 800, fontSize: '1.1rem' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Jurisdicción</label>
                                <select disabled={editingParam.is_system} value={editingParam.jurisdiction} onChange={e => setEditingParam({...editingParam, jurisdiction: e.target.value as any})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                    <option value="ALL">Global (ALL)</option>
                                    <option value="VE">Venezuela (VE)</option>
                                    <option value="ES">España (ES)</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Unidad de Medida (Opcional)</label>
                                <input placeholder="Ej: %, USD, Días" value={editingParam.unit || ''} onChange={e => setEditingParam({...editingParam, unit: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '4px', textTransform: 'uppercase' }}>Descripción Profesional</label>
                                <textarea rows={2} value={editingParam.description || ''} onChange={e => setEditingParam({...editingParam, description: e.target.value})} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'none' }} />
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem', background: '#f8fafc', display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
                            {!editingParam.is_system && (
                                <button onClick={() => handleDelete(editingParam)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#991b1b', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <X size={14} /> Eliminar
                                </button>
                            )}
                            <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                                <button onClick={() => setEditingParam(null)} style={{ padding: '0.6rem 1.25rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                                <button onClick={() => handleSave(editingParam)} disabled={saving} style={{ padding: '0.6rem 1.75rem', borderRadius: '8px', border: 'none', background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: 800 }}>
                                    {saving ? 'Guardando...' : 'Aplicar Cambios'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cuerpo Principal */}
            {viewMode === 'sandbox' ? (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2.5rem', maxWidth: '850px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <div style={{ display: 'inline-flex', padding: '16px', background: '#eff6ff', borderRadius: '20px', color: '#1e40af', marginBottom: '1.5rem' }}>
                            <RefreshCw size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Calibrador de Plazos Procesales (Beta)</h2>
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Simulación exacta de lapsos judiciales considerando feriados nacionales y tribunalicios.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Fecha Notificación / Inicio</label>
                            <input type="date" value={sandboxForm.startDate} onChange={e => setSandboxForm({...sandboxForm, startDate: e.target.value})} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Jurisdicción</label>
                            <select value={sandboxForm.jurisdiction} onChange={e => setSandboxForm({...sandboxForm, jurisdiction: e.target.value})} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <option value="VE">Venezuela (VE)</option>
                                <option value="ES">España (ES)</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Lapso (Días)</label>
                            <input type="number" value={sandboxForm.days} onChange={e => setSandboxForm({...sandboxForm, days: parseInt(e.target.value)})} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Tipo de Cómputo</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setSandboxForm({...sandboxForm, mode: 'working'})} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', background: sandboxForm.mode==='working'?'#1e3a8a':'#f1f5f9', color: sandboxForm.mode==='working'?'#fff':'#64748b', fontWeight: 700, cursor: 'pointer' }}>Hábiles</button>
                                <button onClick={() => setSandboxForm({...sandboxForm, mode: 'calendar'})} style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', background: sandboxForm.mode==='calendar'?'#1e3a8a':'#f1f5f9', color: sandboxForm.mode==='calendar'?'#fff':'#64748b', fontWeight: 700, cursor: 'pointer' }}>Continuos</button>
                            </div>
                        </div>
                    </div>

                    <button onClick={handleCalculateTerm} disabled={sandboxLoading} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        {sandboxLoading ? 'Calculando...' : <><Calculator size={20} /> Calcular Fecha de Vencimiento</>}
                    </button>

                    {sandboxResult && (
                        <div style={{ marginTop: '2.5rem', textAlign: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #cbd5e1' }}>
                            <p style={{ margin: '0 0 0.5rem', color: '#64748b', fontSize: '0.85rem', fontWeight: 600 }}>EL LAPSO VENCE EL:</p>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase' }}>
                                {format(sandboxResult, "EEEE, dd 'de' MMMM", { locale: es })}
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e3a8a', opacity: 0.8 }}>{format(sandboxResult, "yyyy")}</div>
                            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', color: '#166534', background: '#dcfce7', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800, width: 'fit-content', margin: '1.5rem auto 0' }}>
                                <CheckCircle size={14} /> Cómputo Verificado según Calendario Oficial
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Vista de Configuración (Dashboard) */
                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem' }}>
                    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1rem', height: 'fit-content', position: 'sticky', top: '1rem' }}>
                        <p style={{ margin: '0 0 0.75rem', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Categorías</p>
                        {[{ key: 'ALL', label: 'Todos', count: params.length, icon: <Globe size={15} />, color: '#475569', bg: '#f8fafc' },
                        ...Object.entries(CATEGORY_CONFIG).map(([k, v]) => ({
                            key: k, label: v.label, count: categoryCounts[k] || 0, icon: v.icon, color: v.color, bg: v.bg
                        }))
                        ].map(item => (
                            <button key={item.key} onClick={() => setActiveCategory(item.key as any)} style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '10px', border: 'none', background: activeCategory === item.key ? item.bg : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px', textAlign: 'left' }}>
                                <span style={{ color: item.color }}>{item.icon}</span>
                                <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: activeCategory === item.key ? 700 : 500, color: activeCategory === item.key ? item.color : '#475569' }}>{item.label}</span>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', borderRadius: '9px', padding: '1px 7px' }}>{item.count}</span>
                            </button>
                        ))}
                    </div>

                    <div>
                        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar parámetros..." style={{ width: '100%', paddingLeft: '2.5rem', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }} />
                        </div>

                        {loading ? <div style={{ textAlign: 'center', padding: '4rem' }}><RefreshCw size={32} className="animate-spin" /></div> :
                            Object.entries(grouped).map(([cat, items]) => {
                                const cfg = CATEGORY_CONFIG[cat as ParamCategory];
                                return (
                                    <div key={cat} style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.6rem 1rem', background: cfg.bg, borderRadius: '10px', borderLeft: `4px solid ${cfg.color}` }}>
                                            <span style={{ color: cfg.color }}>{cfg.icon}</span>
                                            <span style={{ fontWeight: 800, fontSize: '0.82rem', color: cfg.color, textTransform: 'uppercase' }}>{cfg.label}</span>
                                            <span style={{ fontSize: '0.7rem', color: cfg.color, opacity: 0.7, marginLeft: 'auto' }}>{items.length} parámetros</span>
                                            {cat === 'DIVISAS' && canEdit && (
                                                <button onClick={handleRefreshRates} style={{ marginLeft: '1rem', padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', background: cfg.color, color: 'white', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><RefreshCw size={12} /> Sincronizar BCV</button>
                                            )}
                                        </div>
                                        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                            {items.map((p, idx) => (
                                                <div key={p.id} style={{ padding: '1rem 1.25rem', borderBottom: idx < items.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                            <code style={{ fontSize: '0.72rem', color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: '5px' }}>{p.code}</code>
                                                            <button onClick={() => setAuditId(p.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><History size={12} color="#94a3b8" /></button>
                                                            {p.is_system && <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>🔒</span>}
                                                        </div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>{p.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{p.description}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{p.value} {p.unit}</div>
                                                            {canEdit && <button onClick={() => setEditingParam(p)} style={{ border: 'none', background: 'transparent', color: '#4f46e5', fontSize: '0.75rem', cursor: 'pointer' }}><Edit2 size={12} /> Gestionar</button>}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
        </div>
    );
};
