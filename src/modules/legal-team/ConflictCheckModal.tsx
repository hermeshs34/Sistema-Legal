/**
 * ConflictCheckModal.tsx
 * Modal de verificación de conflictos de interés — Fase 5 Innovación
 *
 * Flujo:
 *   1. Usuario rellena datos del nuevo asunto (título, cliente, partes)
 *   2. El motor analiza en tiempo real contra expedientes existentes
 *   3. Resultado: clear → proceder | warning → revisar | conflict → bloquear/waiver
 *   4. Si se procede, se guarda el check y se llama a onProceed(checkId)
 */

import React, { useState, useCallback } from 'react';
import {
    X, Search, AlertTriangle, CheckCircle2, XCircle,
    ShieldAlert, FileText, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';
import { conflictService, CONFLICT_RESULT_CONFIG } from './conflict.service.ts';
import type { ConflictResult, ConflictFound } from './conflict.service.ts';
import { authService } from '../../core/auth.service.ts';

// ── Props ───────────────────────────────────────────────────────────────────

interface ConflictCheckModalProps {
    /** Título pre-rellenado si viene desde ExpedienteForm */
    initialTitle?:        string;
    initialParteActora?:  string;
    initialParteDemandada?: string;
    /** Callback cuando el usuario procede tras check exitoso/waiver */
    onProceed: (checkId: string | null) => void;
    onClose:   () => void;
}

// ── Estilos ─────────────────────────────────────────────────────────────────

const inputCls = `
    w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50
    text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300
    focus:border-indigo-400 placeholder-slate-400 transition
`.trim();

const labelCls = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1';

// ── Componente de resultado individual ──────────────────────────────────────

function ConflictCard({ cf }: { cf: ConflictFound }) {
    const scoreColor = cf.matchScore >= 72 ? '#b91c1c' : '#b45309';
    const tipo = cf.tipo === 'parte_actora'    ? '⚡ Parte Actora'
               : cf.tipo === 'parte_demandada' ? '🛡️ Parte Demandada'
               :                                 '👤 Cliente';

    return (
        <div style={{
            background: '#fff',
            border: `1px solid ${cf.matchScore >= 72 ? '#fca5a5' : '#fcd34d'}`,
            borderRadius: 10,
            padding: '0.75rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem', flex: 1 }}>
                    {cf.titulo}
                </span>
                <span style={{
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    color: scoreColor,
                    marginLeft: 12,
                    minWidth: 40,
                    textAlign: 'right',
                }}>
                    {cf.matchScore}%
                </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                    fontSize: '0.72rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontWeight: 600,
                }}>
                    {tipo}
                </span>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {cf.parte}
                </span>
            </div>
        </div>
    );
}

// ── Componente principal ─────────────────────────────────────────────────────

export const ConflictCheckModal: React.FC<ConflictCheckModalProps> = ({
    initialTitle         = '',
    initialParteActora   = '',
    initialParteDemandada = '',
    onProceed,
    onClose,
}) => {
    const user = authService.getCurrentUser();

    // ── Formulario ──────────────────────────────────────────────────────────
    const [form, setForm] = useState({
        newMatterTitle:    initialTitle,
        newClientName:     '',
        newParteActora:    initialParteActora,
        newParteDemandada: initialParteDemandada,
    });

    // ── Estado del análisis ─────────────────────────────────────────────────
    const [analyzing,      setAnalyzing]      = useState(false);
    const [analyzed,       setAnalyzed]       = useState(false);
    const [result,         setResult]         = useState<ConflictResult | null>(null);
    const [conflictsFound, setConflictsFound] = useState<ConflictFound[]>([]);
    const [riskScore,      setRiskScore]      = useState(0);
    const [showDetail,     setShowDetail]     = useState(false);

    // ── Waiver ──────────────────────────────────────────────────────────────
    const [showWaiver,   setShowWaiver]   = useState(false);
    const [waiverNotes,  setWaiverNotes]  = useState('');
    const [waiverError,  setWaiverError]  = useState('');

    // ── Guardado ─────────────────────────────────────────────────────────────
    const [saving,     setSaving]     = useState(false);
    const [savedId,    setSavedId]    = useState<string | null>(null);
    const [notes,      setNotes]      = useState('');
    const [globalError, setGlobalError] = useState('');

    const canWrite = user && ['consultor_general', 'abogado_senior', 'compliance_officer', 'gerente_firma'].includes(user.role);
    const canWaiver = user && ['consultor_general', 'abogado_senior', 'gerente_firma'].includes(user.role);

    // ── Handlers ────────────────────────────────────────────────────────────

    const handleChange = (field: keyof typeof form) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setForm(prev => ({ ...prev, [field]: e.target.value }));
        // Reset análisis si cambia el formulario
        setAnalyzed(false);
        setResult(null);
        setConflictsFound([]);
        setSavedId(null);
    };

    const handleAnalyze = useCallback(async () => {
        if (!form.newMatterTitle.trim() || !form.newClientName.trim()
            || !form.newParteActora.trim() || !form.newParteDemandada.trim()) {
            setGlobalError('Completa todos los campos antes de analizar.');
            return;
        }
        setGlobalError('');
        setAnalyzing(true);
        try {
            const res = await conflictService.runCheck(form);
            setResult(res.result);
            setConflictsFound(res.conflictsFound);
            setRiskScore(res.riskScore);
            setAnalyzed(true);
            setShowDetail(res.conflictsFound.length > 0);
        } catch (err) {
            setGlobalError('Error al ejecutar el análisis. Intenta de nuevo.');
        } finally {
            setAnalyzing(false);
        }
    }, [form]);

    const handleSaveAndProceed = async () => {
        if (!canWrite) {
            // Proceder sin guardar si no tiene permiso (modo de solo consulta)
            onProceed(null);
            return;
        }
        setSaving(true);
        setGlobalError('');
        try {
            const id = await conflictService.saveCheck(form, {
                result: result!,
                conflictsFound,
                riskScore,
            }, notes);
            setSavedId(id);
            onProceed(id);
        } catch (err: unknown) {
            setGlobalError(err instanceof Error ? err.message : 'Error al guardar.');
        } finally {
            setSaving(false);
        }
    };

    const handleGrantWaiver = async () => {
        if (!waiverNotes.trim()) {
            setWaiverError('Debes documentar el fundamento del consentimiento informado.');
            return;
        }
        if (!savedId) {
            // Primero guardar
            setSaving(true);
            try {
                const id = await conflictService.saveCheck(form, {
                    result: result!,
                    conflictsFound,
                    riskScore,
                }, notes);
                setSavedId(id);
                await conflictService.grantWaiver(id, waiverNotes);
                onProceed(id);
            } catch (err: unknown) {
                setWaiverError(err instanceof Error ? err.message : 'Error al conceder waiver.');
            } finally {
                setSaving(false);
            }
        } else {
            try {
                await conflictService.grantWaiver(savedId, waiverNotes);
                onProceed(savedId);
            } catch (err: unknown) {
                setWaiverError(err instanceof Error ? err.message : 'Error al conceder waiver.');
            }
        }
    };

    // ── Render helpers ──────────────────────────────────────────────────────

    const cfg = result ? CONFLICT_RESULT_CONFIG[result] : null;

    const canProceed = analyzed && (result === 'clear' || result === 'warning');
    const isBlocked  = analyzed && result === 'conflict';

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
        }}>
            <div style={{
                background: '#fff',
                borderRadius: 20,
                width: '100%',
                maxWidth: 640,
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 1.75rem 1rem',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ShieldAlert size={22} color="#6366f1" />
                            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                                Verificación de Conflictos de Interés
                            </h2>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                            Código de Ética del Abogado — Arts. 28-31 (VE) · Arts. 33-35 EGA (ES)
                        </p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <X size={20} color="#94a3b8" />
                    </button>
                </div>

                {/* Cuerpo */}
                <div style={{ padding: '1.25rem 1.75rem', flex: 1 }}>
                    {/* Formulario */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className={labelCls}>Título del Asunto *</label>
                            <input
                                className={inputCls}
                                placeholder="Ej: Reclamación por daños contractuales — García vs. López"
                                value={form.newMatterTitle}
                                onChange={handleChange('newMatterTitle')}
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label className={labelCls}>Cliente que nos contrata *</label>
                            <input
                                className={inputCls}
                                placeholder="Nombre completo del cliente"
                                value={form.newClientName}
                                onChange={handleChange('newClientName')}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Parte Actora *</label>
                            <input
                                className={inputCls}
                                placeholder="Nombre de la parte actora"
                                value={form.newParteActora}
                                onChange={handleChange('newParteActora')}
                            />
                        </div>
                        <div>
                            <label className={labelCls}>Parte Demandada *</label>
                            <input
                                className={inputCls}
                                placeholder="Nombre de la parte demandada"
                                value={form.newParteDemandada}
                                onChange={handleChange('newParteDemandada')}
                            />
                        </div>
                    </div>

                    {/* Botón Analizar */}
                    {!analyzed && (
                        <button
                            onClick={handleAnalyze}
                            disabled={analyzing}
                            style={{
                                width: '100%',
                                background: analyzing ? '#94a3b8' : '#6366f1',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 12,
                                padding: '0.85rem 1.5rem',
                                fontWeight: 700,
                                fontSize: '0.9rem',
                                cursor: analyzing ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                transition: 'background 0.2s',
                            }}
                        >
                            {analyzing ? (
                                <>
                                    <Clock size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                    Analizando expedientes…
                                </>
                            ) : (
                                <>
                                    <Search size={16} />
                                    Analizar Conflictos de Interés
                                </>
                            )}
                        </button>
                    )}

                    {/* Banner de resultado */}
                    {analyzed && cfg && (
                        <div style={{
                            background: cfg.bg,
                            border: `2px solid ${cfg.border}`,
                            borderRadius: 14,
                            padding: '1rem 1.25rem',
                            marginBottom: '1rem',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <span style={{ fontSize: '1.4rem' }}>{cfg.icon}</span>
                                <div>
                                    <div style={{ fontWeight: 800, color: cfg.color, fontSize: '0.95rem' }}>
                                        {cfg.label}
                                        {riskScore > 0 && (
                                            <span style={{
                                                marginLeft: 10,
                                                fontSize: '0.75rem',
                                                background: cfg.border,
                                                color: cfg.color,
                                                borderRadius: 6,
                                                padding: '1px 8px',
                                                fontWeight: 700,
                                            }}>
                                                Score: {riskScore}/100
                                            </span>
                                        )}
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', marginTop: 2 }}>
                                        {cfg.description}
                                    </p>
                                </div>
                            </div>

                            {/* Toggle de detalle */}
                            {conflictsFound.length > 0 && (
                                <button
                                    onClick={() => setShowDetail(p => !p)}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        fontSize: '0.78rem', color: cfg.color, fontWeight: 700,
                                        marginTop: 4, padding: 0,
                                    }}
                                >
                                    {showDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {conflictsFound.length} expediente(s) con coincidencia
                                </button>
                            )}
                        </div>
                    )}

                    {/* Lista de conflictos */}
                    {showDetail && conflictsFound.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
                            {conflictsFound.map((cf, i) => (
                                <ConflictCard key={`${cf.expedienteId}-${i}`} cf={cf} />
                            ))}
                        </div>
                    )}

                    {/* Notas internas */}
                    {analyzed && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label className={labelCls}>Notas internas (opcional)</label>
                            <textarea
                                className={inputCls}
                                placeholder="Observaciones adicionales para el expediente del check…"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                style={{ resize: 'vertical' }}
                            />
                        </div>
                    )}

                    {/* Waiver — conflicto confirmado */}
                    {isBlocked && canWaiver && (
                        <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fca5a5',
                            borderRadius: 12,
                            padding: '1rem',
                            marginBottom: '1rem',
                        }}>
                            <button
                                onClick={() => setShowWaiver(p => !p)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontWeight: 700, color: '#b91c1c', fontSize: '0.85rem',
                                    display: 'flex', alignItems: 'center', gap: 6, padding: 0,
                                }}
                            >
                                <AlertTriangle size={16} />
                                Conceder Consentimiento Informado (Waiver)
                                {showWaiver ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {showWaiver && (
                                <div style={{ marginTop: '0.75rem' }}>
                                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#7f1d1d' }}>
                                        El waiver requiere consentimiento <strong>por escrito</strong> de todas las partes afectadas
                                        y debe documentarse exhaustivamente. Arts. 28-31 Código de Ética VE.
                                    </p>
                                    <textarea
                                        className={inputCls}
                                        placeholder="Documenta el fundamento del waiver: partes que consintieron, fecha, modo de obtención del consentimiento…"
                                        value={waiverNotes}
                                        onChange={e => { setWaiverNotes(e.target.value); setWaiverError(''); }}
                                        rows={3}
                                        style={{ resize: 'vertical', background: '#fff' }}
                                    />
                                    {waiverError && (
                                        <p style={{ color: '#b91c1c', fontSize: '0.75rem', margin: '4px 0 0' }}>
                                            {waiverError}
                                        </p>
                                    )}
                                    <button
                                        onClick={handleGrantWaiver}
                                        disabled={saving}
                                        style={{
                                            marginTop: '0.5rem',
                                            background: '#b91c1c',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: 10,
                                            padding: '0.65rem 1.25rem',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            cursor: saving ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {saving ? 'Guardando…' : 'Conceder Waiver y Proceder'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {globalError && (
                        <p style={{ color: '#b91c1c', fontSize: '0.8rem', margin: '0.5rem 0' }}>
                            ⚠️ {globalError}
                        </p>
                    )}

                    {/* Re-analizar */}
                    {analyzed && (
                        <button
                            onClick={() => { setAnalyzed(false); setResult(null); setConflictsFound([]); setSavedId(null); }}
                            style={{
                                background: 'none', border: 'none', color: '#6366f1',
                                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                padding: 0, marginBottom: '0.5rem',
                            }}
                        >
                            ↩ Modificar datos y re-analizar
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.75rem 1.5rem',
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#f8fafc', border: '1px solid #e2e8f0',
                            borderRadius: 10, padding: '0.65rem 1.25rem',
                            fontWeight: 600, fontSize: '0.875rem', color: '#64748b', cursor: 'pointer',
                        }}
                    >
                        Cancelar
                    </button>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {/* Proceder sin guardar (solo ver) */}
                        {!canWrite && analyzed && (result === 'clear' || result === 'warning') && (
                            <button
                                onClick={() => onProceed(null)}
                                style={{
                                    background: '#6366f1', color: '#fff', border: 'none',
                                    borderRadius: 10, padding: '0.65rem 1.25rem',
                                    fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}
                            >
                                <CheckCircle2 size={15} />
                                Proceder
                            </button>
                        )}

                        {/* Guardar y proceder */}
                        {canWrite && canProceed && (
                            <button
                                onClick={handleSaveAndProceed}
                                disabled={saving}
                                style={{
                                    background: result === 'clear' ? '#16a34a' : '#d97706',
                                    color: '#fff', border: 'none',
                                    borderRadius: 10, padding: '0.65rem 1.5rem',
                                    fontWeight: 700, fontSize: '0.875rem',
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    opacity: saving ? 0.7 : 1,
                                }}
                            >
                                {result === 'clear' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                                {saving ? 'Guardando…' : 'Guardar y Proceder'}
                            </button>
                        )}

                        {/* Bloqueado sin waiver */}
                        {isBlocked && !canWaiver && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                color: '#b91c1c', fontSize: '0.85rem', fontWeight: 700,
                            }}>
                                <XCircle size={16} />
                                Requiere aprobación senior
                            </div>
                        )}

                        {/* Omitir check (solo lectura) */}
                        {!analyzed && (
                            <button
                                onClick={() => onProceed(null)}
                                style={{
                                    background: '#f8fafc', border: '1px solid #e2e8f0',
                                    borderRadius: 10, padding: '0.65rem 1.25rem',
                                    fontWeight: 600, fontSize: '0.875rem', color: '#64748b',
                                    cursor: 'pointer',
                                }}
                            >
                                <FileText size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: 'middle' }} />
                                Omitir verificación
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
