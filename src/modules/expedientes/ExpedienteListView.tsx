import React, { useState, useEffect } from 'react';
import {
    Scale, Plus, Search, RefreshCw, ChevronRight,
    Trophy, XCircle, Clock, Gavel, TrendingUp
} from 'lucide-react';
import { expedienteService } from './expediente.service.ts';
import type { Expediente } from './types.ts';
import { STATUS_CONFIG, RIESGO_CONFIG, TIPO_PROCESO_LABELS } from './types.ts';
import { ExpedienteForm } from './ExpedienteForm';
import { ExpedienteDetailModal } from './ExpedienteDetailModal';

export const ExpedienteListView: React.FC = () => {
    const [expedientes, setExpedientes] = useState<Expediente[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterRiesgo, setFilterRiesgo] = useState<string>('ALL');
    const [showForm, setShowForm] = useState(false);
    const [editingExp, setEditingExp] = useState<Expediente | null>(null);
    const [selectedExp, setSelectedExp] = useState<Expediente | null>(null);
    const [stats, setStats] = useState({ total: 0, activos: 0, ganados: 0, perdidos: 0, cuantiaTotal: 0, proximas7dias: 0 });

    const load = async () => {
        setLoading(true);
        const [data, st] = await Promise.all([
            expedienteService.getAll(),
            expedienteService.getStats(),
        ]);
        setExpedientes(data);
        setStats(st);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filtered = expedientes.filter(e => {
        const q = search.toLowerCase();
        const matchSearch = !q || e.titulo.toLowerCase().includes(q) ||
            e.parteActora.toLowerCase().includes(q) ||
            e.parteDemandada.toLowerCase().includes(q) ||
            (e.numeroExpediente?.toLowerCase().includes(q) ?? false);
        const matchStatus = filterStatus === 'ALL' || e.status === filterStatus;
        const matchRiesgo = filterRiesgo === 'ALL' || e.riesgo === filterRiesgo;
        return matchSearch && matchStatus && matchRiesgo;
    });

    const handleSaved = () => {
        setShowForm(false);
        setEditingExp(null);
        load();
    };

    const handleEdit = (exp: Expediente) => {
        setEditingExp(exp);
        setShowForm(true);
        setSelectedExp(null);
    };

    // ── Styles ──────────────────────────────────────────────────────────────
    const cardStyle: React.CSSProperties = {
        background: '#fff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.25rem 1.5rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Scale size={28} color="#6366f1" /> Módulo Judicial
                    </h1>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                        Gestión de expedientes, actuaciones procesales y audiencias
                    </p>
                </div>
                <button
                    onClick={() => { setEditingExp(null); setShowForm(true); }}
                    style={{
                        padding: '0.75rem 1.5rem', borderRadius: '12px', border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: 'white', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                    }}
                >
                    <Plus size={18} /> Nuevo Expediente
                </button>
            </div>

            {/* ── Stats cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {[
                    { icon: <Gavel size={20} />, label: 'Total', value: stats.total, color: '#6366f1' },
                    { icon: <Scale size={20} />, label: 'Activos', value: stats.activos, color: '#16a34a' },
                    { icon: <Trophy size={20} />, label: 'Ganados', value: stats.ganados, color: '#1d4ed8' },
                    { icon: <XCircle size={20} />, label: 'Perdidos', value: stats.perdidos, color: '#b91c1c' },
                    { icon: <Clock size={20} />, label: 'Audiencias 7d', value: stats.proximas7dias, color: '#d97706' },
                    {
                        icon: <TrendingUp size={20} />, label: 'Cuantía Total',
                        value: stats.cuantiaTotal > 0
                            ? `$${(stats.cuantiaTotal / 1000).toFixed(0)}K`
                            : '—',
                        color: '#0891b2'
                    },
                ].map(s => (
                    <div key={s.label} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '1rem 1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ color: s.color, marginBottom: '0.4rem' }}>{s.icon}</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a' }}>{s.value}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Filtros ── */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por título, partes, número de expediente..."
                        style={{
                            width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem',
                            borderRadius: '10px', border: '1px solid #e2e8f0',
                            fontSize: '0.875rem', outline: 'none',
                            background: '#fff', color: '#1e293b',
                        }}
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.875rem', color: '#334155', cursor: 'pointer' }}
                >
                    <option value="ALL">Todos los estados</option>
                    <option value="ACTIVO">🟢 Activo</option>
                    <option value="SUSPENDIDO">⏸️ Suspendido</option>
                    <option value="GANADO">🏆 Ganado</option>
                    <option value="PERDIDO">❌ Perdido</option>
                    <option value="CONCILIADO">🤝 Conciliado</option>
                    <option value="CERRADO">⬛ Cerrado</option>
                </select>
                <select
                    value={filterRiesgo}
                    onChange={e => setFilterRiesgo(e.target.value)}
                    style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '0.875rem', color: '#334155', cursor: 'pointer' }}
                >
                    <option value="ALL">Todos los riesgos</option>
                    <option value="CRITICAL">🔴 Crítico</option>
                    <option value="HIGH">🟠 Alto</option>
                    <option value="MEDIUM">🟡 Medio</option>
                    <option value="LOW">🟢 Bajo</option>
                </select>
                <button
                    onClick={load}
                    style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' }}
                    title="Recargar"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {/* ── Lista ── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                    <Scale size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>Cargando expedientes...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '16px' }}>
                    <Gavel size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p style={{ fontSize: '1rem', fontWeight: 600 }}>
                        {expedientes.length === 0 ? 'No hay expedientes registrados' : 'Sin resultados para los filtros aplicados'}
                    </p>
                    {expedientes.length === 0 && (
                        <button
                            onClick={() => setShowForm(true)}
                            style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', background: '#6366f1', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                        >
                            Crear Primer Expediente
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(exp => {
                        const stCfg = STATUS_CONFIG[exp.status];
                        const rCfg = RIESGO_CONFIG[exp.riesgo];
                        return (
                            <div
                                key={exp.id}
                                style={cardStyle}
                                onClick={() => setSelectedExp(exp)}
                                onMouseEnter={e => {
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(99,102,241,0.15)';
                                    e.currentTarget.style.borderColor = '#a5b4fc';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                    {/* Info principal */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', fontFamily: 'monospace' }}>{exp.id}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, background: stCfg.bg, color: stCfg.color }}>{stCfg.label}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800, background: 'linear-gradient(135deg, #7c3aed, #6366f1)', color: 'white' }}>⚡ IA PREDICTIVA</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: rCfg.color }}>⚡ {rCfg.label}</span>
                                            <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 600, background: '#f1f5f9', color: '#475569' }}>
                                                {TIPO_PROCESO_LABELS[exp.tipoProceso]}
                                            </span>
                                        </div>
                                        <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {exp.titulo}
                                        </h3>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <span>⚔️ <strong>{exp.parteActora}</strong> vs <strong>{exp.parteDemandada}</strong></span>
                                            {exp.tribunal && <span>🏛️ {exp.tribunal}</span>}
                                            {exp.numeroExpediente && <span>📋 {exp.numeroExpediente}</span>}
                                        </div>
                                    </div>

                                    {/* Cuantía + acción */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                                        {exp.cuantia && (
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>CUANTÍA</div>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                                                    {exp.currency} {exp.cuantia.toLocaleString('es-VE')}
                                                </div>
                                            </div>
                                        )}
                                        <ChevronRight size={20} color="#94a3b8" />
                                    </div>
                                </div>

                                {/* Fechas */}
                                {(exp.fechaInicio || exp.fechaCierre) && (
                                    <div style={{ display: 'flex', gap: '1.5rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9', fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {exp.fechaInicio && <span>📅 Inicio: <strong style={{ color: '#64748b' }}>{new Date(exp.fechaInicio).toLocaleDateString('es-VE')}</strong></span>}
                                        {exp.fechaCierre && <span>🏁 Cierre: <strong style={{ color: '#64748b' }}>{new Date(exp.fechaCierre).toLocaleDateString('es-VE')}</strong></span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Modales ── */}
            {showForm && (
                <ExpedienteForm
                    expediente={editingExp}
                    onSaved={handleSaved}
                    onClose={() => { setShowForm(false); setEditingExp(null); }}
                />
            )}
            {selectedExp && !showForm && (
                <ExpedienteDetailModal
                    expediente={selectedExp}
                    onClose={() => setSelectedExp(null)}
                    onEdit={() => handleEdit(selectedExp)}
                    onRefresh={load}
                />
            )}
        </div>
    );
};
