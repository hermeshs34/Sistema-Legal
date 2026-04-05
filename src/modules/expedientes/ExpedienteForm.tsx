import React, { useState } from 'react';
import { X, Scale, Save, AlertCircle } from 'lucide-react';
import { expedienteService } from './expediente.service.ts';
import { authService } from '../../core/auth.service.ts';
import type { Expediente, TipoProceso, NuestraPosicion, ExpedienteStatus, RiesgoNivel } from './types.ts';
import { TIPO_PROCESO_LABELS } from './types.ts';

interface ExpedienteFormProps {
    expediente?: Expediente | null;
    onSaved: () => void;
    onClose: () => void;
}

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    fontSize: '0.875rem',
    color: '#1e293b',
    background: '#f8fafc',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.4rem',
};

const groupStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column' };

export const ExpedienteForm: React.FC<ExpedienteFormProps> = ({ expediente, onSaved, onClose }) => {
    const user = authService.getCurrentUser();
    const isEdit = Boolean(expediente?.id);

    const [form, setForm] = useState({
        titulo: expediente?.titulo ?? '',
        tipoProceso: expediente?.tipoProceso ?? 'CIVIL' as TipoProceso,
        materia: expediente?.materia ?? '',
        parteActora: expediente?.parteActora ?? '',
        parteDemandada: expediente?.parteDemandada ?? '',
        nuestraPosicion: expediente?.nuestraPosicion ?? 'DEMANDADO' as NuestraPosicion,
        status: expediente?.status ?? 'ACTIVO' as ExpedienteStatus,
        riesgo: expediente?.riesgo ?? 'MEDIUM' as RiesgoNivel,
        tribunal: expediente?.tribunal ?? '',
        numeroExpediente: expediente?.numeroExpediente ?? '',
        sala: '',
        cuantia: expediente?.cuantia?.toString() ?? '',
        currency: expediente?.currency ?? 'USD' as 'VES' | 'USD' | 'EUR',
        fechaInicio: expediente?.fechaInicio?.slice(0, 10) ?? '',
        fechaCierre: expediente?.fechaCierre?.slice(0, 10) ?? '',
        descripcion: expediente?.descripcion ?? '',
        region: expediente?.region ?? 'VE',
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!form.titulo.trim()) { setError('El título es obligatorio.'); return; }
        if (!form.parteActora.trim()) { setError('La parte actora es obligatoria.'); return; }
        if (!form.parteDemandada.trim()) { setError('La parte demandada es obligatoria.'); return; }

        setSaving(true);
        try {
            await expedienteService.save({
                ...(isEdit ? { id: expediente!.id } : {}),
                organizationId: user?.organizationId,
                titulo: form.titulo.trim(),
                tipoProceso: form.tipoProceso,
                materia: form.materia || undefined,
                parteActora: form.parteActora.trim(),
                parteDemandada: form.parteDemandada.trim(),
                nuestraPosicion: form.nuestraPosicion,
                status: form.status,
                riesgo: form.riesgo,
                tribunal: form.tribunal || undefined,
                numeroExpediente: form.numeroExpediente || undefined,
                cuantia: form.cuantia ? parseFloat(form.cuantia) : undefined,
                currency: form.currency,
                fechaInicio: form.fechaInicio || undefined,
                fechaCierre: form.fechaCierre || undefined,
                descripcion: form.descripcion || undefined,
                region: form.region,
            });
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al guardar el expediente.');
        } finally {
            setSaving(false);
        }
    };

    const SectionTitle = ({ children }: { children: React.ReactNode }) => (
        <h4 style={{ margin: '1.5rem 0 1rem', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
            {children}
        </h4>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '780px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '1.5rem 2rem', background: 'linear-gradient(135deg, #4f46e5, #6366f1)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Scale size={24} />
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                                {isEdit ? `Editar — ${expediente!.id}` : 'Nuevo Expediente Judicial'}
                            </h2>
                            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', opacity: 0.8 }}>
                                {isEdit ? 'Modifique los datos del expediente' : 'Complete la información del caso'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' }}>

                    {error && (
                        <div style={{ padding: '0.875rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem', color: '#b91c1c' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <SectionTitle>📋 Identificación del caso</SectionTitle>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Título del expediente *</label>
                            <input style={inputStyle} value={form.titulo} onChange={e => set('titulo', e.target.value)}
                                placeholder="Ej: Reclamación por incumplimiento contractual contra XXXXX C.A."
                                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                            <div style={groupStyle}>
                                <label style={labelStyle}>Número de expediente</label>
                                <input style={inputStyle} value={form.numeroExpediente} onChange={e => set('numeroExpediente', e.target.value)} placeholder="Ej: AP31-V-2026-000123" onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }} onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
                            </div>
                            <div style={groupStyle}>
                                <label style={labelStyle}>Tipo de proceso *</label>
                                <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.tipoProceso} onChange={e => set('tipoProceso', e.target.value)}>
                                    {(Object.keys(TIPO_PROCESO_LABELS) as TipoProceso[]).map(k => (
                                        <option key={k} value={k}>{TIPO_PROCESO_LABELS[k]}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={groupStyle}>
                                <label style={labelStyle}>Materia</label>
                                <input style={inputStyle} value={form.materia} onChange={e => set('materia', e.target.value)} placeholder="Ej: Cobro de Bolívares" onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }} onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
                            </div>
                        </div>
                    </div>

                    <SectionTitle>⚔️ Partes del proceso</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Parte actora *</label>
                            <input style={inputStyle} value={form.parteActora} onChange={e => set('parteActora', e.target.value)} placeholder="Nombre o razón social" onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }} onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
                        </div>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Parte demandada *</label>
                            <input style={inputStyle} value={form.parteDemandada} onChange={e => set('parteDemandada', e.target.value)} placeholder="Nombre o razón social" onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }} onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
                        </div>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Nuestra posición</label>
                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.nuestraPosicion} onChange={e => set('nuestraPosicion', e.target.value)}>
                                <option value="ACTOR">Actor (demandante)</option>
                                <option value="DEMANDADO">Demandado</option>
                                <option value="TERCERO">Tercero interviniente</option>
                                <option value="ARBITRO">Árbitro</option>
                            </select>
                        </div>
                    </div>

                    <SectionTitle>🏛️ Tribunal</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Nombre del tribunal / corte</label>
                            <input style={inputStyle} value={form.tribunal} onChange={e => set('tribunal', e.target.value)} placeholder="Ej: Tribunal 5° Civil Caracas" onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }} onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
                        </div>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Región / Jurisdicción</label>
                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.region} onChange={e => set('region', e.target.value)}>
                                <option value="VE">🇻🇪 Venezuela</option>
                                <option value="ES">🇪🇸 España</option>
                                <option value="EU">🇪🇺 Unión Europea</option>
                                <option value="INTL">🌍 Internacional</option>
                            </select>
                        </div>
                    </div>

                    <SectionTitle>📊 Estado y riesgo</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '1rem' }}>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Estado</label>
                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.status} onChange={e => set('status', e.target.value)}>
                                <option value="ACTIVO">🟢 Activo</option>
                                <option value="SUSPENDIDO">⏸️ Suspendido</option>
                                <option value="GANADO">🏆 Ganado</option>
                                <option value="PERDIDO">❌ Perdido</option>
                                <option value="CONCILIADO">🤝 Conciliado</option>
                                <option value="CERRADO">⬛ Cerrado</option>
                            </select>
                        </div>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Nivel de riesgo</label>
                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.riesgo} onChange={e => set('riesgo', e.target.value)}>
                                <option value="LOW">🟢 Bajo</option>
                                <option value="MEDIUM">🟡 Medio</option>
                                <option value="HIGH">🟠 Alto</option>
                                <option value="CRITICAL">🔴 Crítico</option>
                            </select>
                        </div>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Moneda</label>
                            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.currency} onChange={e => set('currency', e.target.value as 'VES'|'USD'|'EUR')}>
                                <option value="USD">USD $</option>
                                <option value="VES">VES Bs.</option>
                                <option value="EUR">EUR €</option>
                            </select>
                        </div>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Cuantía estimada</label>
                            <input style={inputStyle} type="number" min="0" step="0.01" value={form.cuantia} onChange={e => set('cuantia', e.target.value)} placeholder="0.00" onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }} onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }} />
                        </div>
                    </div>

                    <SectionTitle>📅 Fechas</SectionTitle>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Fecha de inicio</label>
                            <input style={inputStyle} type="date" value={form.fechaInicio} onChange={e => set('fechaInicio', e.target.value)} />
                        </div>
                        <div style={groupStyle}>
                            <label style={labelStyle}>Fecha estimada de cierre</label>
                            <input style={inputStyle} type="date" value={form.fechaCierre} onChange={e => set('fechaCierre', e.target.value)} />
                        </div>
                    </div>

                    <SectionTitle>📝 Notas internas</SectionTitle>
                    <textarea
                        style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                        value={form.descripcion}
                        onChange={e => set('descripcion', e.target.value)}
                        placeholder="Contexto del caso, antecedentes, observaciones internas..."
                        onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                </form>

                {/* Footer */}
                <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexShrink: 0 }}>
                    <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit as any}
                        disabled={saving}
                        style={{
                            padding: '0.75rem 1.75rem', borderRadius: '10px', border: 'none',
                            background: saving ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                            color: 'white', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        }}
                    >
                        <Save size={16} /> {saving ? 'Guardando...' : isEdit ? 'Guardar Cambios' : 'Crear Expediente'}
                    </button>
                </div>
            </div>
        </div>
    );
};
