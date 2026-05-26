import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Search, Mail, Phone, Hash, ExternalLink, Edit2, Trash2,
    UserCheck, UserX, Briefcase, ShieldCheck, ShieldAlert, ShieldX,
    AlertTriangle, CheckCircle, Clock, RefreshCw, Upload, X, ChevronDown, ChevronUp
} from 'lucide-react';
import type { Lawyer } from './types.ts';
import { lawyerService } from './lawyers.service.ts';
import { LawyerForm } from './LawyerForm.tsx';
import { LawyerDossierModal } from './LawyerDossierModal.tsx';
import {
    inpreService,
    INPRE_STATUS_CONFIG,
    type InpreStatus,
    type InpreVerification,
    type InpreAlert,
} from './inpreabogado.service.ts';
import { authService } from '../../core/auth.service.ts';

// ── Modal de verificación INPRE ───────────────────────────────────────────────

interface InpreModalProps {
    lawyer: Lawyer;
    verification: InpreVerification | null;
    onClose: () => void;
    onSaved: () => void;
}

const InpreVerifyModal: React.FC<InpreModalProps> = ({ lawyer, verification, onClose, onSaved }) => {
    const [status, setStatus] = useState<InpreStatus>(verification?.status ?? 'no_verificado');
    const [notes, setNotes]   = useState(verification?.notes ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await inpreService.saveVerification({
                lawyerId: lawyer.id,
                inpre:    lawyer.inpreabogado,
                status,
                notes:    notes.trim() || undefined,
            });
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.message ?? 'Error desconocido');
        } finally {
            setSaving(false);
        }
    };

    const cfg = INPRE_STATUS_CONFIG[status];

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: '20px', padding: '2rem',
                width: '100%', maxWidth: '520px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                            Verificar Inscripción INPRE
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                            Ley de Abogados Art. 4 — Venezuela
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Datos del abogado */}
                <div style={{
                    background: '#f8fafc', borderRadius: '12px', padding: '1rem',
                    border: '1px solid #e2e8f0', marginBottom: '1.5rem',
                    display: 'flex', gap: '1rem', alignItems: 'center',
                }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: '1.25rem', flexShrink: 0,
                    }}>
                        {lawyer.name.charAt(0)}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{lawyer.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace', fontWeight: 600 }}>
                            INPRE N° {lawyer.inpreabogado}
                        </div>
                    </div>
                </div>

                {/* Selector de estado */}
                <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                        Estado de la inscripción *
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {(['activo', 'suspendido', 'inhabilitado', 'no_verificado'] as InpreStatus[]).map(s => {
                            const c = INPRE_STATUS_CONFIG[s];
                            return (
                                <label key={s} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer',
                                    border: `2px solid ${status === s ? c.color + '60' : '#e2e8f0'}`,
                                    background: status === s ? c.bg : '#fff',
                                    transition: 'all 0.15s',
                                }}>
                                    <input type="radio" name="inpre_status" value={s}
                                        checked={status === s}
                                        onChange={() => setStatus(s)}
                                        style={{ accentColor: c.color }} />
                                    <span style={{ fontSize: '1rem' }}>{c.emoji}</span>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: c.color }}>{c.label}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{c.description}</div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                {/* Notas */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                        Notas de verificación (fuente consultada, fecha de consulta, etc.)
                    </label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3}
                        placeholder="Ej: Consultado en la sede INPRE Caracas el 18/05/2026. Número de confirmación: #12345."
                        style={{
                            width: '100%', boxSizing: 'border-box',
                            padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                            fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit',
                            outline: 'none', color: '#334155',
                        }}
                    />
                </div>

                {/* Estado previo */}
                {verification?.verifiedAt && (
                    <div style={{
                        padding: '0.75rem 1rem', borderRadius: '10px',
                        background: '#f0f9ff', border: '1px solid #bae6fd',
                        fontSize: '0.75rem', color: '#0369a1', marginBottom: '1rem',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                        <Clock size={13} />
                        Última verificación: {new Date(verification.verifiedAt).toLocaleDateString('es-VE')}
                        {verification.verifiedByName ? ` por ${verification.verifiedByName}` : ''}
                    </div>
                )}

                {error && (
                    <div style={{
                        padding: '0.75rem 1rem', borderRadius: '10px',
                        background: '#fef2f2', border: '1px solid #fca5a5',
                        fontSize: '0.8rem', color: '#dc2626', marginBottom: '1rem',
                    }}>{error}</div>
                )}

                {/* Botones */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button onClick={onClose} style={{
                        flex: 1, padding: '0.75rem', borderRadius: '10px',
                        border: '1px solid #e2e8f0', background: '#f8fafc',
                        color: '#64748b', fontWeight: 600, cursor: 'pointer',
                    }}>Cancelar</button>
                    <button onClick={handleSave} disabled={saving} style={{
                        flex: 2, padding: '0.75rem', borderRadius: '10px', border: 'none',
                        background: saving ? '#93c5fd' : 'var(--legal-900)',
                        color: '#fff', fontWeight: 700, cursor: saving ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                        {saving ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <ShieldCheck size={16} />}
                        {saving ? 'Guardando...' : 'Guardar verificación'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Insignia INPRE ────────────────────────────────────────────────────────────

const InpreBadge: React.FC<{ status: InpreStatus; compact?: boolean }> = ({ status, compact = false }) => {
    const cfg = INPRE_STATUS_CONFIG[status];
    return (
        <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: compact ? '2px 8px' : '4px 10px',
            borderRadius: '999px',
            background: cfg.bg, color: cfg.color,
            border: `1px solid ${cfg.border}`,
            fontSize: compact ? '0.65rem' : '0.72rem',
            fontWeight: 800,
        }}>
            {cfg.emoji}
            <span>{cfg.label}</span>
        </div>
    );
};

// ── Banner de alertas INPRE ───────────────────────────────────────────────────

const InpreAlertsBanner: React.FC<{ alerts: InpreAlert[]; onVerify: (lawyerId: string) => void }> = ({ alerts, onVerify }) => {
    const [expanded, setExpanded] = useState(false);

    if (alerts.length === 0) return null;

    const criticals = alerts.filter(a => a.severity === 'critical').length;
    const warnings  = alerts.filter(a => a.severity === 'warning').length;

    return (
        <div style={{
            borderRadius: '14px',
            border: `1px solid ${criticals > 0 ? '#fca5a5' : '#fcd34d'}`,
            background: criticals > 0 ? '#fef2f2' : '#fffbeb',
            overflow: 'hidden',
        }}>
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.25rem', background: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <ShieldAlert size={20} color={criticals > 0 ? '#dc2626' : '#d97706'} />
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: criticals > 0 ? '#991b1b' : '#92400e' }}>
                        Alertas de Verificación INPRE
                    </div>
                    <div style={{ fontSize: '0.75rem', color: criticals > 0 ? '#b91c1c' : '#b45309' }}>
                        {criticals > 0 && `${criticals} crítica${criticals > 1 ? 's' : ''}`}
                        {criticals > 0 && warnings > 0 && ' · '}
                        {warnings > 0 && `${warnings} advertencia${warnings > 1 ? 's' : ''}`}
                        {' — Requerido por Ley de Abogados Art. 4'}
                    </div>
                </div>
                {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {expanded && (
                <div style={{ borderTop: `1px solid ${criticals > 0 ? '#fca5a5' : '#fcd34d'}`, padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {alerts.map(alert => (
                            <div key={alert.lawyerId} style={{
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                padding: '0.75rem 1rem', borderRadius: '10px',
                                background: alert.severity === 'critical' ? '#fee2e2' : '#fefce8',
                                border: `1px solid ${alert.severity === 'critical' ? '#fca5a5' : '#fde68a'}`,
                            }}>
                                {alert.severity === 'critical'
                                    ? <ShieldX size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                                    : <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
                                }
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                                        {alert.lawyerName}
                                        <span style={{ fontFamily: 'monospace', color: '#64748b', fontWeight: 500, marginLeft: '8px' }}>
                                            INPRE {alert.inpreNumber}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>{alert.message}</div>
                                </div>
                                <button
                                    onClick={() => onVerify(alert.lawyerId)}
                                    style={{
                                        padding: '6px 14px', borderRadius: '8px', border: 'none',
                                        background: alert.severity === 'critical' ? '#dc2626' : '#d97706',
                                        color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                                        cursor: 'pointer', flexShrink: 0,
                                    }}
                                >
                                    Verificar
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Componente principal ──────────────────────────────────────────────────────

export const LawyerListView: React.FC = () => {
    const [lawyers, setLawyers]           = useState<Lawyer[]>([]);
    const [verifications, setVerifications] = useState<Map<string, InpreVerification>>(new Map());
    const [alerts, setAlerts]             = useState<InpreAlert[]>([]);
    const [searchTerm, setSearchTerm]     = useState('');
    const [filterType, setFilterType]     = useState<'ALL' | 'INTERNAL' | 'EXTERNAL'>('ALL');
    const [filterInpre, setFilterInpre]   = useState<InpreStatus | 'ALL'>('ALL');

    // Modal state
    const [isFormOpen, setIsFormOpen]         = useState(false);
    const [editingLawyer, setEditingLawyer]   = useState<Lawyer | undefined>(undefined);
    const [viewingDossier, setViewingDossier] = useState<Lawyer | undefined>(undefined);
    const [inpreModal, setInpreModal]         = useState<{ lawyer: Lawyer; verification: InpreVerification | null } | null>(null);

    const currentUser  = authService.getCurrentUser();
    const canVerifyInpre = ['consultor_general', 'abogado_senior', 'compliance_officer', 'gerente_firma']
        .includes(currentUser?.role ?? '');

    const loadData = async () => {
        const data = await lawyerService.getAll();
        setLawyers(data);

        // Cargar verificaciones INPRE
        const allVerifs = await inpreService.getAllVerifications();
        const vMap = new Map(allVerifs.map(v => [v.lawyerId, v]));
        setVerifications(vMap);

        // Generar alertas
        const a = await inpreService.getAlerts(data.map(l => ({ id: l.id, name: l.name, inpreabogado: l.inpreabogado })));
        setAlerts(a);
    };

    useEffect(() => { loadData(); }, []);

    const handleCreate = () => { setEditingLawyer(undefined); setIsFormOpen(true); };
    const handleEdit   = (lawyer: Lawyer) => { setEditingLawyer(lawyer); setIsFormOpen(true); };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de eliminar a este miembro del directorio?')) {
            await lawyerService.delete(id);
            await loadData();
        }
    };

    const handleSave = async () => { await loadData(); setIsFormOpen(false); };

    const handleOpenInpre = async (lawyer: Lawyer) => {
        const v = verifications.get(lawyer.id) ?? await inpreService.getVerification(lawyer.id);
        setInpreModal({ lawyer, verification: v });
    };

    const handleVerifyFromAlert = (lawyerId: string) => {
        const lawyer = lawyers.find(l => l.id === lawyerId);
        if (lawyer) handleOpenInpre(lawyer);
    };

    const filteredLawyers = lawyers.filter(l => {
        const matchesSearch =
            l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.inpreabogado.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType  = filterType === 'ALL'   || l.type === filterType;
        const inpreStatus  = verifications.get(l.id)?.status ?? 'no_verificado';
        const matchesInpre = filterInpre === 'ALL'  || inpreStatus === filterInpre;

        return matchesSearch && matchesType && matchesInpre;
    });

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;

    return (
        <div className="space-y-6" style={{ fontFamily: 'var(--font-body)' }}>

            {/* ── Header ── */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '12px',
                        background: 'linear-gradient(135deg, var(--legal-900) 0%, #1e40af 100%)',
                        borderRadius: '16px', color: '#fff',
                        boxShadow: '0 8px 16px rgba(30,58,138,0.15)',
                    }}>
                        <Users size={32} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.025em', margin: 0 }}>
                            Directorio Legal Pro
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '4px 0 0 0' }}>
                            Gestión centralizada de capital humano jurídico · Verificación INPRE (Ley de Abogados Art. 4)
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {criticalCount > 0 && (
                        <div style={{
                            padding: '0.4rem 0.9rem', borderRadius: '999px',
                            background: '#fef2f2', border: '1px solid #fca5a5',
                            color: '#dc2626', fontSize: '0.78rem', fontWeight: 800,
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            <ShieldX size={14} /> {criticalCount} crítica{criticalCount > 1 ? 's' : ''}
                        </div>
                    )}
                    <button
                        className="btn-primary"
                        onClick={handleCreate}
                        style={{
                            padding: '0.8rem 1.5rem', borderRadius: '12px',
                            background: 'var(--legal-900)',
                            boxShadow: '0 4px 12px rgba(30,58,138,0.2)',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        <Plus size={20} /> Agregar Profesional
                    </button>
                </div>
            </div>

            {/* ── Alertas INPRE ── */}
            {alerts.length > 0 && (
                <InpreAlertsBanner alerts={alerts} onVerify={handleVerifyFromAlert} />
            )}

            {/* ── Barra de control ── */}
            <div className="premium-card" style={{ padding: '1.25rem', background: '#fff', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, especialidad, INPRE o contacto..."
                        className="form-input"
                        style={{ width: '100%', padding: '0.875rem 1rem 0.875rem 3.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', boxSizing: 'border-box' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Filtro tipo */}
                    <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        {[{ id: 'ALL', label: 'Todos' }, { id: 'INTERNAL', label: 'Internos' }, { id: 'EXTERNAL', label: 'Externos' }].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id as any)}
                                style={{
                                    padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none',
                                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                    background: filterType === type.id ? '#fff' : 'transparent',
                                    color: filterType === type.id ? 'var(--legal-900)' : '#64748b',
                                    boxShadow: filterType === type.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s',
                                }}
                            >{type.label}</button>
                        ))}
                    </div>

                    {/* Filtro INPRE */}
                    <select
                        value={filterInpre}
                        onChange={e => setFilterInpre(e.target.value as any)}
                        style={{
                            padding: '0.6rem 1rem', borderRadius: '10px',
                            border: '1px solid #e2e8f0', background: '#f8fafc',
                            fontSize: '0.85rem', fontWeight: 600, color: '#374151', cursor: 'pointer',
                        }}
                    >
                        <option value="ALL">🔍 Todos los estados INPRE</option>
                        <option value="activo">✅ INPRE Activo</option>
                        <option value="suspendido">⚠️ Suspendido</option>
                        <option value="inhabilitado">🚫 Inhabilitado</option>
                        <option value="no_verificado">❓ Sin verificar</option>
                    </select>
                </div>
            </div>

            {/* ── Grid de tarjetas ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.75rem', marginTop: '1rem' }}>
                {filteredLawyers.length === 0 ? (
                    <div style={{
                        gridColumn: '1 / -1', padding: '5rem', textAlign: 'center',
                        background: '#fff', borderRadius: '20px', border: '2px dashed #e2e8f0', color: '#94a3b8',
                    }}>
                        <Users size={64} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No se encontraron miembros en el directorio legal.</p>
                        <p style={{ fontSize: '0.9rem' }}>Intente con otros términos de búsqueda o filtros.</p>
                    </div>
                ) : filteredLawyers.map(lawyer => {
                    const verif      = verifications.get(lawyer.id);
                    const inpreStatus: InpreStatus = verif?.status ?? 'no_verificado';
                    const inpreCfg   = INPRE_STATUS_CONFIG[inpreStatus];
                    const daysLeft   = inpreService.daysUntilReview(verif ?? null);
                    const reviewSoon = daysLeft !== null && daysLeft <= 60;

                    return (
                        <div
                            key={lawyer.id}
                            className="premium-card"
                            style={{ background: '#fff', padding: '1.75rem', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            {/* Status Stripe */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                                background: lawyer.type === 'INTERNAL'
                                    ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                                    : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                            }} />

                            {/* Top row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                <div style={{
                                    padding: '6px 14px', borderRadius: '20px',
                                    background: lawyer.type === 'INTERNAL' ? '#f0fdf4' : '#eff6ff',
                                    color: lawyer.type === 'INTERNAL' ? '#166534' : '#1e40af',
                                    fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                                    border: '1px solid ' + (lawyer.type === 'INTERNAL' ? '#bcf0da' : '#bfdbfe'),
                                }}>
                                    {lawyer.type === 'INTERNAL' ? '💎 Equipo Interno' : '🌍 Externo / Aliado'}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleEdit(lawyer)}
                                        style={{ padding: '8px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                                        title="Editar perfil">
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(lawyer.id)}
                                        style={{ padding: '8px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; }}
                                        title="Eliminar de directorio">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Avatar + Nombre */}
                            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem' }}>
                                <div style={{
                                    width: '64px', height: '64px', borderRadius: '18px',
                                    background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--legal-800)', border: '1px solid #e2e8f0',
                                    fontSize: '1.5rem', fontWeight: 700,
                                }}>
                                    {lawyer.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px', letterSpacing: '-0.01em' }}>{lawyer.name}</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--legal-700)', fontSize: '0.85rem', fontWeight: 600 }}>
                                        <Briefcase size={14} />{lawyer.specialty}
                                    </div>
                                </div>
                            </div>

                            {/* INPRE + Estado */}
                            <div style={{
                                background: '#f8fafc', padding: '1rem', borderRadius: '12px',
                                border: `1px solid ${inpreCfg.border}`, marginBottom: '1.25rem',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>INPRE / RIF</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>{lawyer.inpreabogado}</div>
                                    </div>
                                    <InpreBadge status={inpreStatus} compact />
                                </div>

                                {/* Próxima revisión */}
                                {verif?.nextReview && daysLeft !== null && (
                                    <div style={{
                                        fontSize: '0.7rem', color: reviewSoon ? '#92400e' : '#64748b',
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '4px 8px', borderRadius: '6px',
                                        background: reviewSoon ? '#fffbeb' : '#f1f5f9',
                                    }}>
                                        <Clock size={11} />
                                        {daysLeft > 0
                                            ? `Próxima revisión en ${daysLeft} días`
                                            : `Revisión vencida hace ${Math.abs(daysLeft)} días`}
                                    </div>
                                )}

                                {/* Estado operativo */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem', color: lawyer.isActive ? '#10b981' : '#ef4444', fontSize: '0.72rem', fontWeight: 800 }}>
                                    {lawyer.isActive ? <UserCheck size={13} /> : <UserX size={13} />}
                                    {lawyer.isActive ? 'OPERATIVO' : 'INACTIVO'}
                                </div>
                            </div>

                            {/* Contacto */}
                            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#475569', fontSize: '0.88rem' }}>
                                    <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}><Mail size={14} /></div>
                                    {lawyer.email}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#475569', fontSize: '0.88rem' }}>
                                    <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}><Phone size={14} /></div>
                                    {lawyer.phone}
                                </div>
                            </div>

                            {/* Acciones */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={() => setViewingDossier(lawyer)}
                                    style={{
                                        flex: 1, padding: '0.6rem', borderRadius: '10px',
                                        border: '1px solid #e2e8f0', background: '#fff',
                                        color: '#475569', fontSize: '0.85rem', fontWeight: 600,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
                                >
                                    <Hash size={14} /> Ver Expediente
                                </button>

                                {/* Botón verificar INPRE */}
                                {canVerifyInpre && (
                                    <button
                                        onClick={() => handleOpenInpre(lawyer)}
                                        title="Gestionar verificación INPRE"
                                        style={{
                                            padding: '0.6rem 1rem', borderRadius: '10px', border: 'none',
                                            background: inpreStatus === 'activo' ? '#f0fdf4' : inpreStatus === 'no_verificado' ? '#fef3c7' : '#fef2f2',
                                            color: inpreStatus === 'activo' ? '#166534' : inpreStatus === 'no_verificado' ? '#92400e' : '#991b1b',
                                            fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <ShieldCheck size={15} />
                                        INPRE
                                    </button>
                                )}

                                <button style={{
                                    padding: '0.6rem 0.8rem', borderRadius: '10px', border: 'none',
                                    background: 'var(--legal-50)', color: 'var(--legal-900)',
                                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--legal-100)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--legal-50)'; }}
                                >
                                    <ExternalLink size={15} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Modal Form ── */}
            {isFormOpen && (
                <LawyerForm initialData={editingLawyer} onClose={() => setIsFormOpen(false)} onSave={handleSave} />
            )}

            {/* ── Dossier Modal ── */}
            {viewingDossier && (
                <LawyerDossierModal lawyer={viewingDossier} onClose={() => setViewingDossier(undefined)} />
            )}

            {/* ── Modal verificación INPRE ── */}
            {inpreModal && (
                <InpreVerifyModal
                    lawyer={inpreModal.lawyer}
                    verification={inpreModal.verification}
                    onClose={() => setInpreModal(null)}
                    onSaved={loadData}
                />
            )}

            <style>{`
                .premium-card { border-radius: 20px; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};
