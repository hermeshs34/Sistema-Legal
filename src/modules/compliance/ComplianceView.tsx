import React, { useState, useEffect } from 'react';
import {
    ShieldAlert, ShieldCheck, ShieldEllipsis, AlertTriangle, Shield,
    Activity, Plus, Search, ChevronRight, Info,
    Calendar, Briefcase, FileText, CheckCircle2, XCircle, Clock,
    Edit2, Trash2, Zap, Download
} from 'lucide-react';
import { complianceService } from './compliance.service.ts';
import { bcvRateService } from '../shared/bcv-rate.service.ts';
import { reportService } from '../shared/report.service.ts';
import type { ComplianceItem, ComplianceStatus, RiskArea, RiskLevel, RiskSummary } from './types.ts';
import { ComplianceForm } from './ComplianceForm.tsx';

/**
 * ComplianceView.tsx
 * Centro de Control de Riesgos y Auditoría Legal.
 * Integra la matriz de cumplimiento normativo con la trazabilidad forense de IA y RGPD.
 */
export const ComplianceView: React.FC = () => {
    const [items, setItems] = useState<ComplianceItem[]>([]);
    const [summary, setSummary] = useState<RiskSummary>({
        totalItems: 0,
        compliantCount: 0,
        nonCompliantCount: 0,
        criticalRiskCount: 0,
        highRiskCount: 0,
        pendingTasks: 0
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterArea, setFilterArea] = useState<RiskArea | 'ALL'>('ALL');
    const [filterRisk, setFilterRisk] = useState<RiskLevel | 'ALL'>('ALL');

    // Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ComplianceItem | undefined>(undefined);
    
    // Audit state
    const [activeTab, setActiveTab] = useState<'RISKS' | 'AUDIT' | 'REPORT_NORM' | 'REPORT_EXEC'>('RISKS');
    const [consentLogs, setConsentLogs] = useState<any[]>([]);
    const [aiLogs, setAiLogs] = useState<any[]>([]);
    const [bcvRate, setBcvRate] = useState<number>(37.95);

    const loadData = async () => {
        const data = await complianceService.getAll();
        setItems(data);
        setSummary(complianceService.getSummary(data));
        
        if (activeTab === 'AUDIT') {
            const [cLogs, aLogs, rateData] = await Promise.all([
                complianceService.getConsentAuditLogs(),
                complianceService.getAiUsageLogs(),
                bcvRateService.getTodayRate()
            ]);
            setConsentLogs(cLogs);
            setAiLogs(aLogs);
            if (rateData) setBcvRate(rateData.usd_rate);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const handleCreate = () => {
        setEditingItem(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (item: ComplianceItem) => {
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de eliminar esta evaluación de cumplimiento?')) {
            await complianceService.delete(id);
            loadData();
        }
    };

    const handleSave = async () => {
        await loadData();
        setIsFormOpen(false);
    };

    const filteredItems = items.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesArea = filterArea === 'ALL' || item.area === filterArea;
        const matchesRisk = filterRisk === 'ALL' || item.riskLevel === filterRisk;
        return matchesSearch && matchesArea && matchesRisk;
    });

    const getStatusStyle = (status: ComplianceStatus) => {
        switch (status) {
            case 'COMPLIANT': return { bg: '#f0fdf4', text: '#166534', icon: <CheckCircle2 size={16} />, label: 'Cumple' };
            case 'NON_COMPLIANT': return { bg: '#fff1f2', text: '#9f1239', icon: <XCircle size={16} />, label: 'No Cumple' };
            case 'PARTIAL': return { bg: '#fffbeb', text: '#92400e', icon: <Clock size={16} />, label: 'Parcial' };
            case 'PENDING': return { bg: '#f8fafc', text: '#475569', icon: <Info size={16} />, label: 'Pendiente' };
            case 'EXPIRED': return { bg: '#fef2f2', text: '#b91c1c', icon: <ShieldAlert size={16} />, label: 'Vencido' };
            default: return { bg: '#f1f5f9', text: '#64748b', icon: <Info size={16} />, label: 'N/A' };
        }
    };

    const getRiskStyle = (level: RiskLevel) => {
        switch (level) {
            case 'CRITICAL': return { color: '#ef4444', label: 'Crítico', bg: '#fef2f2' };
            case 'HIGH': return { color: '#f97316', label: 'Alto', bg: '#fff7ed' };
            case 'MEDIUM': return { color: '#eab308', label: 'Medio', bg: '#fefce8' };
            case 'LOW': return { color: '#22c55e', label: 'Bajo', bg: '#f0fdf4' };
        }
    };

    return (
        <div className="space-y-6" style={{ fontFamily: 'var(--font-body)' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '12px',
                        background: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
                        borderRadius: '16px',
                        color: '#fff',
                        boxShadow: '0 8px 16px rgba(124, 58, 237, 0.2)'
                    }}>
                        <ShieldAlert size={32} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.025em', margin: 0 }}>
                            Gestión de Cumplimiento & Riesgos
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '4px 0 0 0' }}>
                            Trazabilidad obligatoria, auditoría forense y control de IA.
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button 
                        onClick={() => reportService.generateVencimientosReport()}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.4rem', 
                            padding: '0.6rem 1rem', background: '#0f172a', color: '#fff',
                            border: 'none', borderRadius: '10px', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.82rem',
                            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.3)'
                        }}
                    >
                        <Download size={16} /> R-05 · Vencimientos
                    </button>
                    <button 
                        onClick={() => reportService.generateFinOpsReport()}
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: '0.4rem', 
                            padding: '0.6rem 1rem', background: '#1e3a8a', color: '#fff',
                            border: 'none', borderRadius: '10px', cursor: 'pointer',
                            fontWeight: 700, fontSize: '0.82rem',
                            boxShadow: '0 4px 6px -1px rgba(30, 58, 138, 0.3)'
                        }}
                    >
                        <Download size={16} /> R-09 · FinOps
                    </button>
                    <button className="btn-primary" style={{ background: '#7c3aed' }} onClick={handleCreate}>
                        <Plus size={20} /> Nueva Evaluación
                    </button>
                </div>
            </div>

            {/* Tab Selector */}
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '2px solid #f1f5f9', marginBottom: '2rem' }}>
                <button 
                    onClick={() => setActiveTab('RISKS')}
                    style={{
                        padding: '0.75rem 0.5rem', border: 'none', background: 'none',
                        fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                        color: activeTab === 'RISKS' ? '#7c3aed' : '#94a3b8',
                        borderBottom: activeTab === 'RISKS' ? '3px solid #7c3aed' : '3px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    Matriz de Riesgos
                </button>
                <button 
                    onClick={() => setActiveTab('AUDIT')}
                    style={{
                        padding: '0.75rem 0.5rem', border: 'none', background: 'none',
                        fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                        color: activeTab === 'AUDIT' ? '#7c3aed' : '#94a3b8',
                        borderBottom: activeTab === 'AUDIT' ? '3px solid #7c3aed' : '3px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    Trazabilidad Legal & IA Audit
                </button>
                <button 
                    onClick={() => setActiveTab('REPORT_NORM')}
                    style={{
                        padding: '0.75rem 0.5rem', border: 'none', background: 'none',
                        fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                        color: activeTab === 'REPORT_NORM' ? '#7c3aed' : '#94a3b8',
                        borderBottom: activeTab === 'REPORT_NORM' ? '3px solid #7c3aed' : '3px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    📋 Reportes Normativos
                </button>
                <button 
                    onClick={() => setActiveTab('REPORT_EXEC')}
                    style={{
                        padding: '0.75rem 0.5rem', border: 'none', background: 'none',
                        fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                        color: activeTab === 'REPORT_EXEC' ? '#7c3aed' : '#94a3b8',
                        borderBottom: activeTab === 'REPORT_EXEC' ? '3px solid #7c3aed' : '3px solid transparent',
                        transition: 'all 0.2s'
                    }}
                >
                    📊 Reportes Ejecutivos
                </button>
            </div>

            {activeTab === 'RISKS' && (
                <>
                    {/* Summary KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="premium-card" style={{ padding: '1.5rem', background: '#fff', borderLeft: '4px solid #7c3aed' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>Puntos Controlados</p>
                                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{summary.totalItems}</h3>
                                </div>
                                <div style={{ padding: '10px', background: '#f5f3ff', borderRadius: '12px', color: '#7c3aed' }}>
                                    <Activity size={24} />
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', fontSize: '0.875rem' }}>
                                <ShieldCheck size={16} />
                                <span>{Math.round((summary.compliantCount / (summary.totalItems || 1)) * 100)}% de cumplimiento base</span>
                            </div>
                        </div>

                        <div className="premium-card" style={{ padding: '1.5rem', background: '#fff', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>Riesgos Críticos</p>
                                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', margin: 0 }}>{summary.criticalRiskCount}</h3>
                                </div>
                                <div style={{ padding: '10px', background: '#fef2f2', borderRadius: '12px', color: '#ef4444' }}>
                                    <AlertTriangle size={24} />
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c', fontSize: '0.875rem' }}>
                                <XCircle size={16} />
                                <span>Requiere acción inmediata</span>
                            </div>
                        </div>

                        <div className="premium-card" style={{ padding: '1.5rem', background: '#fff', borderLeft: '4px solid #f97316' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>Tareas Pendientes</p>
                                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#f97316', margin: 0 }}>{summary.pendingTasks}</h3>
                                </div>
                                <div style={{ padding: '10px', background: '#fff7ed', borderRadius: '12px', color: '#f97316' }}>
                                    <Clock size={24} />
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c2410c', fontSize: '0.875rem' }}>
                                <Info size={16} />
                                <span>En revisión o progreso</span>
                            </div>
                        </div>
                    </div>

                    {/* Matrix & Filters Section */}
                    <div className="premium-card" style={{ background: '#fff', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                                <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                <input
                                    type="text"
                                    placeholder="Buscar requisito o área..."
                                    className="form-input"
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem' }}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <select
                                    className="form-input"
                                    style={{ padding: '0.6rem 1rem' }}
                                    value={filterArea}
                                    onChange={(e) => setFilterArea(e.target.value as any)}
                                >
                                    <option value="ALL">Todas las Áreas</option>
                                    <option value="LEGAL">Legal / Corporativo</option>
                                    <option value="TAX">Tributario / Fiscal</option>
                                    <option value="LABOR">Laboral</option>
                                    <option value="REGULATORY">Regulatorio</option>
                                    <option value="ENVIRONMENTAL">Ambiental</option>
                                    <option value="OPERATIONAL">Operacional</option>
                                </select>
                                <select
                                    className="form-input"
                                    style={{ padding: '0.6rem 1rem' }}
                                    value={filterRisk}
                                    onChange={(e) => setFilterRisk(e.target.value as any)}
                                >
                                    <option value="ALL">Todos los Niveles</option>
                                    <option value="CRITICAL">Crítico</option>
                                    <option value="HIGH">Alto</option>
                                    <option value="MEDIUM">Medio</option>
                                    <option value="LOW">Bajo</option>
                                </select>
                            </div>
                        </div>

                        {/* List Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        <th style={{ padding: '1rem' }}>Requisito de Cumplimiento</th>
                                        <th style={{ padding: '1rem' }}>Área</th>
                                        <th style={{ padding: '1rem' }}>Riesgo</th>
                                        <th style={{ padding: '1rem' }}>Estatus</th>
                                        <th style={{ padding: '1rem' }}>Próxima Rev.</th>
                                        <th style={{ padding: '1rem' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map(item => {
                                        const statusInfo = getStatusStyle(item.status);
                                        const riskInfo = getRiskStyle(item.riskLevel);
                                        return (
                                            <tr key={item.id} style={{ background: '#fff', transition: 'all 0.2s' }}>
                                                <td style={{ padding: '1.25rem 1rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderLeft: '1px solid #f1f5f9', borderRadius: '12px 0 0 12px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{item.title}</span>
                                                        {item.legalCitation && (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>
                                                                <Shield size={12} />
                                                                {item.legalCitation}
                                                            </div>
                                                        )}
                                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID: {item.id}</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.85rem', fontWeight: 600 }}>
                                                        {item.area === 'TAX' && <FileText size={14} />}
                                                        {item.area === 'LEGAL' && <Briefcase size={14} />}
                                                        {item.area === 'LABOR' && <ChevronRight size={14} />}
                                                        {item.area}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                                                    <span style={{
                                                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800,
                                                        background: riskInfo.bg, color: riskInfo.color, border: `1px solid ${riskInfo.color}20`
                                                    }}>
                                                        {riskInfo.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                                        padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                                                        background: statusInfo.bg, color: statusInfo.text
                                                    }}>
                                                        {statusInfo.icon}
                                                        {statusInfo.label}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                                                        <Calendar size={14} />
                                                        {item.nextReview}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1.25rem 1rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', borderRadius: '0 12px 12px 0' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#4c1d95', cursor: 'pointer' }}
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', color: '#ef4444', cursor: 'pointer' }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {filteredItems.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                <ShieldEllipsis size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p>No se encontraron requisitos con los filtros seleccionados.</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'AUDIT' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {/* Consent Trail Table */}
                    <div className="premium-card" style={{ padding: '1.5rem', background: '#fff' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShieldCheck size={20} /> Trazabilidad de Consentimientos (RGPD)
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.8rem' }}>
                                        <th style={{ padding: '1rem' }}>Usuario</th>
                                        <th style={{ padding: '1rem' }}>Versión</th>
                                        <th style={{ padding: '1rem' }}>Fecha Aceptación</th>
                                        <th style={{ padding: '1rem' }}>Estatus</th>
                                        <th style={{ padding: '1rem' }}>Navegador/Origen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {consentLogs.map(log => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{log.profiles?.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{log.profiles?.email}</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem' }}><span className="status-badge status-active">{log.policy_version}</span></td>
                                            <td style={{ padding: '1rem' }}>{new Date(log.accepted_at).toLocaleString()}</td>
                                            <td style={{ padding: '1rem' }}>
                                                {log.withdrawn_at ? 
                                                    <span style={{ color: '#ef4444', fontWeight: 700 }}>RETIRADO</span> : 
                                                    <span style={{ color: '#22c55e', fontWeight: 700 }}>VIGENTE</span>
                                                }
                                            </td>
                                            <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.75rem' }}>{log.user_agent?.substring(0, 40)}...</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* AI Usage Dashboard (FinOps) */}
                    <div className="premium-card" style={{ padding: '1.5rem', background: '#fff' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Zap size={20} /> Auditoría de Uso IA (FinOps)
                        </h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontSize: '0.8rem' }}>
                                        <th style={{ padding: '1rem' }}>Funcionalidad</th>
                                        <th style={{ padding: '1rem' }}>Modelo</th>
                                        <th style={{ padding: '1rem' }}>Usuario</th>
                                        <th style={{ padding: '1rem' }}>Costo (USD)</th>
                                        <th style={{ padding: '1rem' }}>Inversión (VES)</th>
                                        <th style={{ padding: '1rem' }}>Fecha/Hora</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {aiLogs.map(log => {
                                        const costUsd = ((log.prompt_tokens + log.completion_tokens) / 1000000) * 0.15;
                                        const costVes = costUsd * bcvRate;
                                        return (
                                            <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc', fontSize: '0.85rem' }}>
                                                <td style={{ padding: '1rem', fontWeight: 600 }}>{log.feature?.toUpperCase()}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                        {log.model}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{log.profiles?.name}</td>
                                                <td style={{ padding: '1rem', fontWeight: 700 }}>${costUsd.toFixed(4)}</td>
                                                <td style={{ padding: '1rem', fontWeight: 700 }}>{costVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs</td>
                                                <td style={{ padding: '1rem', color: '#94a3b8' }}>{new Date(log.created_at).toLocaleString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ── TAB: Reportes Normativos ── */}
            {activeTab === 'REPORT_NORM' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
                    {[
                        { code: 'R-04', title: 'Riesgo Contractual', desc: 'Análisis consolidado de riesgo por documento con clasificación semáforo y días al vencimiento.', regions: '🇻🇪 🇪🇺 🏝️', color: '#dc2626', action: () => reportService.generateRiesgoContractual() },
                        { code: 'R-06', title: 'Certificado RGPD/LDPB', desc: 'Certificado de auditoría de consentimiento con sello forense, registro inmutable y hash de integridad.', regions: '⚠️ VE · ✅ EU · ⚠️ Caribe', color: '#166534', action: () => reportService.generateCertificadoRGPD() },
                        { code: 'R-07', title: 'Scorecard de Cumplimiento', desc: 'Indicador global con barras de progreso por área normativa, semáforo y detalle ítem por ítem.', regions: '🇻🇪 🇪🇺 🏝️', color: '#7c3aed', action: () => reportService.generateScorecardCumplimiento() },
                        { code: 'R-08', title: 'Transparencia IA (EU AI Act)', desc: 'Declaración de conformidad con el Reglamento (UE) 2024/1689 incluyendo modelos, supervisión y estadísticas.', regions: '— VE · ✅ EU · ⚠️ Caribe', color: '#1e40af', action: () => reportService.generateTransparenciaIA() },
                        { code: 'R-12', title: 'Declaración Judicial de IA', desc: 'Declaración jurada de uso de IA para presentar ante tribunales con espacio para firma del abogado.', regions: '⚠️ Emergente · ✅ España', color: '#92400e', action: () => reportService.generateDeclaracionIA() },
                    ].map(r => (
                        <div key={r.code} className="premium-card" style={{ padding: '1.5rem', background: '#fff', borderTop: `4px solid ${r.color}`, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: r.color, background: `${r.color}10`, padding: '4px 10px', borderRadius: '6px', letterSpacing: '0.5px' }}>{r.code}</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.regions}</span>
                            </div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{r.title}</h4>
                            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, margin: 0, flex: 1 }}>{r.desc}</p>
                            <button onClick={r.action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem', background: r.color, color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', marginTop: 'auto' }}>
                                <Download size={16} /> Generar PDF
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* ── TAB: Reportes Ejecutivos ── */}
            {activeTab === 'REPORT_EXEC' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
                    {[
                        { code: 'R-05', title: 'Vencimientos y Alertas', desc: 'Consolidación de documentos por urgencia: vencidos, próximos a vencer (7d) y vigentes con días restantes.', regions: '🇻🇪 🇪🇺 🏝️', color: '#0f172a', action: () => reportService.generateVencimientosReport() },
                        { code: 'R-09', title: 'FinOps Legal (Inversión IA)', desc: 'Desglose de consumo de tokens IA por consultor con conversión multi-divisa (USD→VES vía tasa BCV).', regions: '🇻🇪 🇪🇺 🏝️', color: '#1e3a8a', action: () => reportService.generateFinOpsReport() },
                        { code: 'R-10', title: 'Cuantías Multi-Divisa', desc: 'Valoración total de la cartera judicial en USD, VES y EUR con tasa BCV oficial por expediente.', regions: '✅ BCV · ✅ EUR · ✅ USD/XCD', color: '#0d9488', action: () => reportService.generateCuantiasMultidivisa() },
                        { code: 'R-11', title: 'Actividad por Abogado', desc: 'Productividad por consultor: expedientes asignados, casos activos, análisis IA realizados y rol.', regions: '🇻🇪 🇪🇺 🏝️', color: '#7c2d12', action: () => reportService.generateActividadAbogados() },
                    ].map(r => (
                        <div key={r.code} className="premium-card" style={{ padding: '1.5rem', background: '#fff', borderTop: `4px solid ${r.color}`, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 900, color: r.color, background: `${r.color}10`, padding: '4px 10px', borderRadius: '6px', letterSpacing: '0.5px' }}>{r.code}</span>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{r.regions}</span>
                            </div>
                            <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{r.title}</h4>
                            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, margin: 0, flex: 1 }}>{r.desc}</p>
                            <button onClick={r.action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem', background: r.color, color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', marginTop: 'auto' }}>
                                <Download size={16} /> Generar PDF
                            </button>
                        </div>
                    ))}
                </div>
            )}


            {/* Modal Form */}
            {isFormOpen && (
                <ComplianceForm
                    initialData={editingItem}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};
