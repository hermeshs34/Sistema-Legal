/**
 * RATView.tsx — Registro de Actividades de Tratamiento
 * RGPD Art. 30 — Obligatorio para responsables del tratamiento de datos
 *
 * Acceso: compliance_officer, consultor_general, auditor_externo (solo lectura), gerente_firma (solo lectura)
 */

import React, { useState, useEffect } from 'react';
import {
    BookOpen, Plus, Edit2, Search, Shield, AlertTriangle,
    CheckCircle, Clock, Globe, Lock, RefreshCw, X, Save, ChevronDown, ChevronUp
} from 'lucide-react';
import { rgpdService } from '../../core/rgpd.service.ts';
import { authService } from '../../core/auth.service.ts';

// ── Tipos locales ─────────────────────────────────────────────────────────────

interface RATEntry {
    id:                      string;
    name:                    string;
    purpose:                 string;
    legal_basis:             string;
    data_categories:         string[];
    special_categories:      string[];
    data_subjects:           string[];
    recipients:              string[];
    third_country_transfers?: string;
    retention_period:        string;
    security_measures:       string;
    dpo_contact?:            string;
    is_active:               boolean;
    last_review?:            string;
    next_review?:            string;
    created_at:              string;
}

const LEGAL_BASIS_OPTIONS = [
    'Consentimiento del interesado (Art. 6.1.a RGPD)',
    'Ejecución de contrato (Art. 6.1.b RGPD)',
    'Obligación legal (Art. 6.1.c RGPD)',
    'Intereses vitales (Art. 6.1.d RGPD)',
    'Interés público (Art. 6.1.e RGPD)',
    'Interés legítimo (Art. 6.1.f RGPD)',
    'Ejecución de contrato laboral (LOTTT / ET)',
];

const COMMON_CATEGORIES = [
    'nombre', 'apellidos', 'email', 'teléfono', 'dirección', 'RIF/NIF/CI',
    'datos_bancarios', 'datos_procesales', 'contratos', 'expedientes_judiciales',
    'honorarios', 'firma_electrónica', 'IP', 'logs_acceso',
];

const SPECIAL_CATEGORIES = [
    'datos_penales', 'salud', 'origen_étnico', 'opiniones_políticas',
    'religión', 'sindicato', 'datos_genéticos', 'datos_biométricos',
];

// ── Formulario de entrada RAT ─────────────────────────────────────────────────

interface RATFormProps {
    entry: Partial<RATEntry> | null;
    onClose: () => void;
    onSave: () => void;
    orgId: string;
    userId: string;
}

const RATForm: React.FC<RATFormProps> = ({ entry, onClose, onSave, orgId, userId }) => {
    const [form, setForm] = useState({
        name:                   entry?.name ?? '',
        purpose:                entry?.purpose ?? '',
        legal_basis:            entry?.legal_basis ?? LEGAL_BASIS_OPTIONS[1],
        data_categories:        entry?.data_categories ?? [],
        special_categories:     entry?.special_categories ?? [],
        data_subjects:          entry?.data_subjects?.join(', ') ?? '',
        recipients:             entry?.recipients?.join(', ') ?? '',
        third_country_transfers: entry?.third_country_transfers ?? '',
        retention_period:       entry?.retention_period ?? '',
        security_measures:      entry?.security_measures ?? 'Cifrado AES-256, RLS PostgreSQL por organización, auditoría SHA-256, acceso por roles.',
        dpo_contact:            entry?.dpo_contact ?? '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState('');

    const toggleTag = (field: 'data_categories' | 'special_categories', tag: string) => {
        setForm(prev => ({
            ...prev,
            [field]: prev[field].includes(tag)
                ? prev[field].filter((t: string) => t !== tag)
                : [...prev[field], tag],
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name || !form.purpose || !form.retention_period) {
            setError('Complete los campos obligatorios: Nombre, Finalidad y Plazo de conservación.');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await rgpdService.createRATEntry({
                organization_id:         orgId,
                name:                    form.name,
                purpose:                 form.purpose,
                legal_basis:             form.legal_basis,
                data_categories:         form.data_categories,
                retention_period:        form.retention_period,
                security_measures:       form.security_measures,
                recipients:              form.recipients.split(',').map(s => s.trim()).filter(Boolean),
                international_transfers: form.third_country_transfers || undefined,
                created_by:              userId,
            });
            onSave();
        } catch (err: any) {
            setError(err.message ?? 'Error al guardar la actividad de tratamiento.');
        } finally {
            setSaving(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
        border: '1.5px solid #e2e8f0', fontSize: '0.9rem', outline: 'none',
        boxSizing: 'border-box', background: '#f8fafc',
    };
    const labelStyle: React.CSSProperties = {
        display: 'block', fontSize: '0.8rem', fontWeight: 700,
        color: '#374151', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em',
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div style={{ width: '100%', maxWidth: '700px', background: 'white', borderRadius: '20px', boxShadow: '0 25px 50px rgba(0,0,0,0.4)', overflowY: 'auto', maxHeight: '92vh' }}>

                {/* Header */}
                <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #1e3a8a, #1e40af)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>
                            {entry?.id ? 'Editar Actividad de Tratamiento' : 'Nueva Actividad de Tratamiento'}
                        </h3>
                        <p style={{ margin: '0.2rem 0 0', opacity: 0.75, fontSize: '0.8rem' }}>RGPD Art. 30 — Registro de Actividades</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><X size={22} /></button>
                </div>

                <form onSubmit={handleSave} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {error && (
                        <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.85rem' }}>
                            <AlertTriangle size={14} style={{ marginRight: '0.4rem' }} />{error}
                        </div>
                    )}

                    {/* Nombre */}
                    <div>
                        <label style={labelStyle}>Nombre de la Actividad *</label>
                        <input style={inputStyle} placeholder="Ej: Gestión de expedientes judiciales de clientes"
                            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                    </div>

                    {/* Finalidad */}
                    <div>
                        <label style={labelStyle}>Finalidad del Tratamiento *</label>
                        <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                            placeholder="Describa el propósito por el que se tratan estos datos..."
                            value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} required />
                    </div>

                    {/* Base jurídica */}
                    <div>
                        <label style={labelStyle}>Base Jurídica *</label>
                        <select style={{ ...inputStyle, cursor: 'pointer' }}
                            value={form.legal_basis} onChange={e => setForm(p => ({ ...p, legal_basis: e.target.value }))}>
                            {LEGAL_BASIS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>

                    {/* Categorías de datos */}
                    <div>
                        <label style={labelStyle}>Categorías de Datos Personales</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {COMMON_CATEGORIES.map(tag => (
                                <button key={tag} type="button"
                                    onClick={() => toggleTag('data_categories', tag)}
                                    style={{
                                        padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                                        background: form.data_categories.includes(tag) ? '#1e40af' : '#f1f5f9',
                                        color: form.data_categories.includes(tag) ? 'white' : '#475569',
                                        border: form.data_categories.includes(tag) ? '1.5px solid #1e40af' : '1.5px solid #e2e8f0',
                                    }}>
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Categorías especiales */}
                    <div>
                        <label style={{ ...labelStyle, color: '#b91c1c' }}>Categorías Especiales (Art. 9 RGPD)</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {SPECIAL_CATEGORIES.map(tag => (
                                <button key={tag} type="button"
                                    onClick={() => toggleTag('special_categories', tag)}
                                    style={{
                                        padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                        background: form.special_categories.includes(tag) ? '#dc2626' : '#fff5f5',
                                        color: form.special_categories.includes(tag) ? 'white' : '#b91c1c',
                                        border: form.special_categories.includes(tag) ? '1.5px solid #dc2626' : '1.5px solid #fecaca',
                                    }}>
                                    {tag}
                                </button>
                            ))}
                        </div>
                        {form.special_categories.length > 0 && (
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#dc2626' }}>
                                ⚠️ Requiere base jurídica explícita y medidas de seguridad reforzadas (Art. 9.2 RGPD).
                            </p>
                        )}
                    </div>

                    {/* Destinatarios */}
                    <div>
                        <label style={labelStyle}>Destinatarios (separados por coma)</label>
                        <input style={inputStyle} placeholder="Ej: Juzgados, Registros Públicos, Notarías, SUDEBAN"
                            value={form.recipients} onChange={e => setForm(p => ({ ...p, recipients: e.target.value }))} />
                    </div>

                    {/* Transferencias internacionales */}
                    <div>
                        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Globe size={13} /> Transferencias Internacionales
                        </label>
                        <input style={inputStyle} placeholder="Ej: Supabase US (SCCs). Dejar vacío si no aplica."
                            value={form.third_country_transfers}
                            onChange={e => setForm(p => ({ ...p, third_country_transfers: e.target.value }))} />
                    </div>

                    {/* Plazo de conservación */}
                    <div>
                        <label style={labelStyle}>Plazo de Conservación *</label>
                        <input style={inputStyle} placeholder="Ej: 10 años desde el archivo del expediente"
                            value={form.retention_period} onChange={e => setForm(p => ({ ...p, retention_period: e.target.value }))} required />
                    </div>

                    {/* Medidas de seguridad */}
                    <div>
                        <label style={labelStyle}>Medidas de Seguridad Técnicas y Organizativas</label>
                        <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                            value={form.security_measures}
                            onChange={e => setForm(p => ({ ...p, security_measures: e.target.value }))} />
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                        <button type="button" onClick={onClose}
                            style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving}
                            style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Save size={16} />
                            {saving ? 'Guardando...' : 'Guardar Actividad'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Vista principal RAT ───────────────────────────────────────────────────────

export const RATView: React.FC = () => {
    const user = authService.getCurrentUser();
    const [entries, setEntries]       = useState<RATEntry[]>([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [showForm, setShowForm]     = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const canEdit = user?.role != null && (['compliance_officer', 'consultor_general'] as string[]).includes(user.role);

    useEffect(() => { loadEntries(); }, []);

    const loadEntries = async () => {
        if (!user?.organizationId) return;
        setLoading(true);
        const data = await rgpdService.getRATEntries(user.organizationId);
        setEntries(data as unknown as RATEntry[]);
        setLoading(false);
    };

    const filtered = entries.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.purpose.toLowerCase().includes(search.toLowerCase()) ||
        e.legal_basis.toLowerCase().includes(search.toLowerCase())
    );

    const hasSpecialData = (e: RATEntry) => e.special_categories?.length > 0;

    const isOverdue = (e: RATEntry) => {
        if (!e.next_review) return false;
        return new Date(e.next_review) < new Date();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.4s ease-out' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#1e3a8a', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <BookOpen size={30} /> Registro de Actividades de Tratamiento
                    </h2>
                    <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>
                        RGPD Art. 30 — Obligación del Responsable del Tratamiento · {entries.length} actividades registradas
                    </p>
                </div>
                {canEdit && (
                    <button onClick={() => setShowForm(true)}
                        style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg,#1e3a8a,#2563eb)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 8px 20px rgba(37,99,235,0.3)' }}>
                        <Plus size={18} /> Nueva Actividad
                    </button>
                )}
            </div>

            {/* Métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                {[
                    { label: 'Total Actividades',     value: entries.length,                                  icon: BookOpen,    color: '#2563eb' },
                    { label: 'Activas',                value: entries.filter(e => e.is_active).length,        icon: CheckCircle, color: '#059669' },
                    { label: 'Con Datos Sensibles',   value: entries.filter(hasSpecialData).length,          icon: Shield,      color: '#dc2626' },
                    { label: 'Revisión Pendiente',    value: entries.filter(isOverdue).length,               icon: Clock,       color: '#d97706' },
                ].map((s, i) => (
                    <div key={i} className="premium-card" style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>{s.label}</span>
                            <s.icon size={18} color={s.color} />
                        </div>
                        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b' }}>{s.value}</span>
                    </div>
                ))}
            </div>

            {/* Aviso de cumplimiento */}
            <div style={{ padding: '1rem 1.25rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <Shield size={18} color="#1d4ed8" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.83rem', color: '#1e40af', lineHeight: '1.5' }}>
                    <strong>RGPD Art. 30:</strong> El RAT debe mantenerse actualizado y estar disponible para la Autoridad de Control (AEPD/CNPDP) bajo solicitud.
                    Las actividades con datos de categoría especial (Art. 9) requieren base jurídica explícita y Evaluación de Impacto (EIPD/DPIA).
                </div>
            </div>

            {/* Búsqueda */}
            <div className="premium-card" style={{ padding: '1rem' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input type="text" placeholder="Buscar por nombre, finalidad o base jurídica..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none', background: '#f8fafc', boxSizing: 'border-box' }} />
                </div>
            </div>

            {/* Lista de actividades */}
            <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                        <RefreshCw size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                        <p style={{ margin: 0 }}>Cargando actividades...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                        <BookOpen size={48} style={{ opacity: 0.2, marginBottom: '1rem', display: 'block', margin: '0 auto 1rem' }} />
                        <p style={{ margin: 0 }}>No hay actividades de tratamiento registradas.</p>
                        {canEdit && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Haga clic en "Nueva Actividad" para comenzar.</p>}
                    </div>
                ) : (
                    filtered.map((entry, idx) => {
                        const isExpanded = expandedId === entry.id;
                        return (
                            <div key={entry.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                {/* Fila resumen */}
                                <div
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                    style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', transition: 'background 0.15s', background: isExpanded ? '#f8fafc' : 'white' }}
                                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#fafafa'; }}
                                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'white'; }}
                                >
                                    {/* Estado */}
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: entry.is_active ? '#10b981' : '#94a3b8' }} />

                                    {/* Info principal */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{entry.name}</span>
                                            {hasSpecialData(entry) && (
                                                <span style={{ padding: '1px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>
                                                    DATOS SENSIBLES
                                                </span>
                                            )}
                                            {isOverdue(entry) && (
                                                <span style={{ padding: '1px 8px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '999px', fontSize: '0.68rem', fontWeight: 700 }}>
                                                    REVISIÓN VENCIDA
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                            <span>{entry.legal_basis.split('(')[0].trim()}</span>
                                            <span>·</span>
                                            <span>{entry.data_categories?.length ?? 0} categorías de datos</span>
                                            {entry.special_categories?.length > 0 && (
                                                <><span>·</span><span style={{ color: '#dc2626' }}>{entry.special_categories.length} especiales</span></>
                                            )}
                                        </div>
                                    </div>

                                    {/* Acciones */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                        {canEdit && (
                                            <button onClick={e => { e.stopPropagation(); /* TODO: editar */ }}
                                                style={{ padding: '0.4rem', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', color: '#64748b' }}>
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                        {isExpanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                    </div>
                                </div>

                                {/* Detalle expandido */}
                                {isExpanded && (
                                    <div style={{ padding: '0 1.5rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginTop: '1.25rem' }}>

                                            <DetailBlock icon={<BookOpen size={14} />} title="Finalidad">
                                                {entry.purpose}
                                            </DetailBlock>

                                            <DetailBlock icon={<Lock size={14} />} title="Base Jurídica">
                                                {entry.legal_basis}
                                            </DetailBlock>

                                            <DetailBlock icon={<Shield size={14} />} title="Categorías de Datos">
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                    {entry.data_categories?.map(t => (
                                                        <span key={t} style={{ padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600 }}>{t}</span>
                                                    ))}
                                                    {entry.special_categories?.map(t => (
                                                        <span key={t} style={{ padding: '2px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600 }}>{t} ⚠️</span>
                                                    ))}
                                                </div>
                                            </DetailBlock>

                                            <DetailBlock icon={<Clock size={14} />} title="Plazo de Conservación">
                                                {entry.retention_period}
                                            </DetailBlock>

                                            {entry.recipients?.length > 0 && (
                                                <DetailBlock icon={<Globe size={14} />} title="Destinatarios">
                                                    {entry.recipients.join(' · ')}
                                                </DetailBlock>
                                            )}

                                            {entry.third_country_transfers && (
                                                <DetailBlock icon={<Globe size={14} color="#d97706" />} title="Transferencias Internacionales">
                                                    <span style={{ color: '#d97706' }}>{entry.third_country_transfers}</span>
                                                </DetailBlock>
                                            )}

                                            <DetailBlock icon={<Shield size={14} color="#059669" />} title="Medidas de Seguridad">
                                                {entry.security_measures}
                                            </DetailBlock>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal formulario */}
            {showForm && user && (
                <RATForm
                    entry={null}
                    orgId={user.organizationId!}
                    userId={user.id}
                    onClose={() => setShowForm(false)}
                    onSave={() => { setShowForm(false); loadEntries(); }}
                />
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

// ── Sub-componente bloque de detalle ──────────────────────────────────────────

const DetailBlock: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div style={{ background: 'white', borderRadius: '10px', padding: '1rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            {icon} {title}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.5' }}>{children}</div>
    </div>
);
