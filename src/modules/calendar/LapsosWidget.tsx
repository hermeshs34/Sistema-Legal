import React, { useState, useEffect } from 'react';
import { Clock, RefreshCw, Calendar, AlertTriangle, CheckCircle, ChevronRight, Edit2, Save, X } from 'lucide-react';
import { calendarService, ALERT_CONFIG, type LapsoCalculado, type JudicialHoliday } from './calendar.service.ts';
import type { TipoProceso } from '../expedientes/types.ts';

interface LapsosWidgetProps {
    expedienteId: string;
    fechaInicio: string;            // ISO date string
    processType: TipoProceso;
    jurisdiction?: string;
}

export const LapsosWidget: React.FC<LapsosWidgetProps> = ({
    expedienteId, fechaInicio, processType, jurisdiction = 'VE'
}) => {
    const [lapsos, setLapsos] = useState<LapsoCalculado[]>([]);
    const [festivos, setFestivos] = useState<JudicialHoliday[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastCalc, setLastCalc] = useState<Date | null>(null);
    const [editingCode, setEditingCode] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; diasHabiles: number }>({ name: '', diasHabiles: 0 });

    const calcular = async () => {
        if (!fechaInicio) return;
        setLoading(true);
        try {
            const [lapsosCalc, proximosFestivos] = await Promise.all([
                calendarService.calcularLapsosExpediente({
                    expedienteId,
                    fechaInicio: new Date(fechaInicio),
                    processType,
                    jurisdiction,
                }),
                calendarService.getProximosFestivos(30, jurisdiction),
            ]);
            setLapsos(lapsosCalc);
            setFestivos(proximosFestivos);
            setLastCalc(new Date());
        } catch (e) {
            console.error('Error calculando lapsos:', e);
        } finally {
            setLoading(false);
        }
    };

    const guardar = async () => {
        setSaving(true);
        try {
            await calendarService.guardarLapsos(expedienteId, lapsos);
            alert('Lapsos actualizados correctamente.');
        } catch (err) {
            console.error('Error al guardar lapsos:', err);
            alert('Error al guardar cambios.');
        } finally {
            setSaving(false);
        }
    };

    const handleEditLapso = (lapso: LapsoCalculado) => {
        setEditingCode(lapso.code);
        setEditForm({ name: lapso.name, diasHabiles: lapso.diasHabiles });
    };

    const applyLapsoAdjustment = async () => {
        if (!editingCode) return;
        const updatedLapsos = [...lapsos];
        const idx = updatedLapsos.findIndex(l => l.code === editingCode);
        if (idx === -1) return;

        const current = updatedLapsos[idx];
        const newVencimiento = await calendarService.calcularFechaVencimiento(
            new Date(current.fechaInicio),
            editForm.diasHabiles,
            jurisdiction
        );

        updatedLapsos[idx] = {
            ...current,
            name: editForm.name,
            diasHabiles: editForm.diasHabiles,
            fechaVencimiento: newVencimiento,
            diasRestantes: Math.ceil((newVencimiento.getTime() - new Date().getTime()) / 86400000),
            // Re-calcular alertas básico simplificado
            alertLevel: newVencimiento < new Date() ? 'expired' : 'ok' 
        };

        setLapsos(updatedLapsos);
        setEditingCode(null);
    };

    useEffect(() => { calcular(); }, [expedienteId, fechaInicio, processType]);

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.75rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>Calculando lapsos procesales...</p>
            </div>
        );
    }

    // Alerta más crítica
    const maxAlert = lapsos.reduce<LapsoCalculado | null>((max, l) => {
        const levels = ['ok', 'info', 'warning', 'critical', 'expired'];
        if (!max || levels.indexOf(l.alertLevel) > levels.indexOf(max.alertLevel)) return l;
        return max;
    }, null);

    return (
        <div>
            {/* ── Header del widget ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} color="#7c3aed" />
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Lapsos Procesales
                    </span>
                    {lastCalc && (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            · calculado {lastCalc.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={calcular} style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <RefreshCw size={12} /> Recalcular
                    </button>
                    {lapsos.length > 0 && (
                        <button onClick={guardar} disabled={saving} style={{ padding: '0.35rem 0.75rem', borderRadius: '8px', border: 'none', background: '#4f46e5', cursor: 'pointer', fontSize: '0.75rem', color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {saving ? <RefreshCw size={12} /> : <CheckCircle size={12} />}
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Banner de alerta máxima ── */}
            {maxAlert && maxAlert.alertLevel !== 'ok' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: ALERT_CONFIG[maxAlert.alertLevel].bg, border: `1px solid ${ALERT_CONFIG[maxAlert.alertLevel].border}`, borderRadius: '10px', marginBottom: '1rem' }}>
                    <AlertTriangle size={16} color={ALERT_CONFIG[maxAlert.alertLevel].color} />
                    <div>
                        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: ALERT_CONFIG[maxAlert.alertLevel].color }}>
                            {ALERT_CONFIG[maxAlert.alertLevel].emoji} {maxAlert.name} — {calendarService.formatDiasRestantes(maxAlert.diasRestantes)}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.73rem', color: ALERT_CONFIG[maxAlert.alertLevel].color, opacity: 0.8 }}>
                            Vence: {calendarService.formatFecha(maxAlert.fechaVencimiento)}
                        </p>
                    </div>
                </div>
            )}

            {lapsos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                    <Clock size={28} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '0.83rem' }}>No hay parámetros de lapsos para materia {processType}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {lapsos.map(l => {
                        const cfg = ALERT_CONFIG[l.alertLevel];
                        return (
                            <div key={l.code} style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${cfg.border}`, overflow: 'hidden' }}>
                                {/* Barra de progreso */}
                                <div style={{ height: '3px', background: '#f1f5f9' }}>
                                    <div style={{ height: '100%', width: `${l.porcentajeTranscurrido}%`, background: cfg.color, transition: 'width 0.5s ease' }} />
                                </div>
                                <div style={{ padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                            {editingCode === l.code ? (
                                                <input 
                                                    style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', border: '1px solid #6366f1', borderRadius: '4px', padding: '2px 4px', width: '200px' }} 
                                                    value={editForm.name} 
                                                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>{l.name}</span>
                                            )}
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: cfg.color, background: cfg.bg, padding: '1px 7px', borderRadius: '20px', border: `1px solid ${cfg.border}` }}>
                                                {cfg.emoji} {cfg.label}
                                            </span>
                                            {editingCode !== l.code && (
                                                <button onClick={() => handleEditLapso(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                                                    <Edit2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.73rem', color: '#64748b', alignItems: 'center' }}>
                                            <span>📅 Inicio: <strong>{new Date(l.fechaInicio).toLocaleDateString('es-VE')}</strong></span>
                                            {editingCode === l.code ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    ⏰ <input 
                                                        type="number" 
                                                        style={{ width: '45px', fontSize: '0.73rem', fontWeight: 700, border: '1px solid #6366f1', borderRadius: '4px', padding: '1px 3px' }} 
                                                        value={editForm.diasHabiles} 
                                                        onChange={e => setEditForm({...editForm, diasHabiles: parseInt(e.target.value) || 0})}
                                                    /> días hábiles
                                                </span>
                                            ) : (
                                                <span>⏰ {l.diasHabiles} días hábiles</span>
                                            )}
                                            <span>📆 Vence: <strong style={{ color: cfg.color }}>{l.fechaVencimiento.toLocaleDateString('es-VE')}</strong></span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                        {editingCode === l.code ? (
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button onClick={applyLapsoAdjustment} style={{ padding: '4px 8px', borderRadius: '6px', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Aplicar"><Save size={12} /></button>
                                                <button onClick={() => setEditingCode(null)} style={{ padding: '4px 8px', borderRadius: '6px', background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Cancelar"><X size={12} /></button>
                                            </div>
                                        ) : (
                                            <>
                                                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: cfg.color, lineHeight: 1 }}>
                                                    {l.diasRestantes < 0 ? '—' : l.diasHabilesRestantes}
                                                </p>
                                                <p style={{ margin: 0, fontSize: '0.65rem', color: '#94a3b8' }}>días hábiles</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {/* Transcurrido */}
                                <div style={{ padding: '0.3rem 1rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, height: '6px', background: '#f1f5f9', borderRadius: '9px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${l.porcentajeTranscurrido}%`, background: cfg.color, borderRadius: '9px', opacity: 0.7, transition: 'width 0.5s ease' }} />
                                    </div>
                                    <span style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>{l.porcentajeTranscurrido}% transcurrido</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Próximos feriados ── */}
            {festivos.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Calendar size={14} color="#64748b" />
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Próximos días no hábiles (30 días)</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {festivos.slice(0, 6).map(f => (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.7rem', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.72rem' }}>
                                <span>{f.type === 'judicial' ? '⚖️' : '🏛️'}</span>
                                <span style={{ fontWeight: 600, color: '#92400e' }}>
                                    {new Date(f.holiday_date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' })}
                                </span>
                                <span style={{ color: '#b45309' }}>{f.name}</span>
                            </div>
                        ))}
                        {festivos.length > 6 && (
                            <div style={{ padding: '0.3rem 0.7rem', background: '#f1f5f9', borderRadius: '8px', fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                +{festivos.length - 6} más <ChevronRight size={10} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
