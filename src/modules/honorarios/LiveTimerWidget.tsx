/**
 * LiveTimerWidget.tsx
 * Widget flotante de seguimiento de tiempo en vivo — Fase 5 Innovación
 *
 * Características:
 * - Flotante en esquina inferior derecha (siempre visible cuando hay sesión)
 * - Selección de matter (asunto) contra el que imputar las horas
 * - Contador en tiempo real: HH:MM:SS
 * - Pausa / Reanuda sin perder el tiempo acumulado
 * - Guarda en la tabla time_entries al detener
 * - Estado persistido en sessionStorage (sobrevive cambios de ruta, no cierre del tab)
 * - Minimizable con un clic
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause, StopCircle, ChevronDown, ChevronUp, Clock, X } from 'lucide-react';
import { authService } from '../../core/auth.service.ts';
import { timeEntryService, matterService } from './honorarios.service.ts';
import type { TimeCategory } from './types.ts';

// ── Tipos locales ────────────────────────────────────────────────────────────

interface TimerState {
    isRunning:          boolean;
    isPaused:           boolean;
    matterId:           string;
    matterTitle:        string;
    category:           TimeCategory;
    description:        string;
    accumulatedSeconds: number;   // Segundos antes de la última pausa
    startedAt:          string | null;  // ISO de cuando se pulsó "play" por última vez
}

const STORAGE_KEY = 'legal_live_timer_v1';

const DEFAULT_STATE: TimerState = {
    isRunning:          false,
    isPaused:           false,
    matterId:           '',
    matterTitle:        '',
    category:           'GENERAL',
    description:        '',
    accumulatedSeconds: 0,
    startedAt:          null,
};

interface MatterOption { id: string; title: string; clientName?: string; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadState(): TimerState {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as TimerState) : DEFAULT_STATE;
    } catch {
        return DEFAULT_STATE;
    }
}

function saveState(state: TimerState): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearState(): void {
    sessionStorage.removeItem(STORAGE_KEY);
}

function formatTime(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function secondsToHours(secs: number): number {
    return Math.round((secs / 3600) * 100) / 100;
}

const CATEGORIES: { value: TimeCategory; label: string }[] = [
    { value: 'HEARING',   label: '🎤 Audiencia' },
    { value: 'DRAFTING',  label: '✍️ Redacción' },
    { value: 'RESEARCH',  label: '🔍 Investigación' },
    { value: 'MEETING',   label: '🤝 Reunión' },
    { value: 'CALL',      label: '📞 Llamada' },
    { value: 'TRAVEL',    label: '🚗 Desplazamiento' },
    { value: 'GENERAL',   label: '⏱️ General' },
];

// ── Componente ───────────────────────────────────────────────────────────────

export const LiveTimerWidget: React.FC = () => {
    const user = authService.getCurrentUser();

    const [timerState, setTimerState] = useState<TimerState>(() => loadState());
    const [elapsed,    setElapsed]    = useState(0);   // Seconds display
    const [minimized,  setMinimized]  = useState(true);
    const [expanded,   setExpanded]   = useState(false); // Form expandida
    const [matters,    setMatters]    = useState<MatterOption[]>([]);
    const [saving,     setSaving]     = useState(false);
    const [saveMsg,    setSaveMsg]    = useState('');
    const [error,      setError]      = useState('');

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Calcula elapsed en tiempo real ────────────────────────────────────

    const computeElapsed = useCallback((state: TimerState): number => {
        if (state.isRunning && !state.isPaused && state.startedAt) {
            const sinceLastStart = Math.floor(
                (Date.now() - new Date(state.startedAt).getTime()) / 1000
            );
            return state.accumulatedSeconds + sinceLastStart;
        }
        return state.accumulatedSeconds;
    }, []);

    // ── Tick ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (timerState.isRunning && !timerState.isPaused) {
            intervalRef.current = setInterval(() => {
                setElapsed(computeElapsed(timerState));
            }, 1000);
        } else {
            setElapsed(computeElapsed(timerState));
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [timerState, computeElapsed]);

    // ── Cargar matters al expandir ────────────────────────────────────────

    useEffect(() => {
        if (!expanded || matters.length > 0 || !user) return;
        matterService.getAll()
            .then(data => {
                setMatters(
                    data
                        .filter(m => m.status === 'OPEN' || m.status === 'ACTIVE')
                        .map(m => ({ id: m.id, title: m.title }))
                );
            })
            .catch(() => {});
    }, [expanded, matters.length, user]);

    // ── Persistir estado ──────────────────────────────────────────────────

    useEffect(() => {
        saveState(timerState);
    }, [timerState]);

    // ── Acciones ──────────────────────────────────────────────────────────

    const handleStart = () => {
        if (!timerState.matterId) {
            setError('Selecciona un asunto antes de iniciar.');
            return;
        }
        setError('');
        const now = new Date().toISOString();
        const next: TimerState = {
            ...timerState,
            isRunning: true,
            isPaused:  false,
            startedAt: now,
        };
        setTimerState(next);
        setMinimized(false);
    };

    const handlePause = () => {
        const acc = computeElapsed(timerState);
        const next: TimerState = {
            ...timerState,
            isPaused:           true,
            accumulatedSeconds: acc,
            startedAt:          null,
        };
        setTimerState(next);
        setElapsed(acc);
    };

    const handleResume = () => {
        const next: TimerState = {
            ...timerState,
            isPaused:  false,
            startedAt: new Date().toISOString(),
        };
        setTimerState(next);
    };

    const handleStop = async () => {
        const totalSeconds = computeElapsed(timerState);
        if (totalSeconds < 60) {
            setError('El tiempo mínimo registrable es 1 minuto.');
            return;
        }
        if (!timerState.matterId || !user) return;

        setSaving(true);
        setError('');

        try {
            const hours = secondsToHours(totalSeconds);
            const today = new Date().toISOString().slice(0, 10);

            await timeEntryService.save({
                matterId:    timerState.matterId,
                userId:      user.id,
                date:        today,
                description: timerState.description.trim() || `Tiempo registrado — ${timerState.matterTitle}`,
                category:    timerState.category,
                hours,
                currency:    'USD',
                rate:        0,    // El usuario puede ajustar la tarifa en HonorariosView
                isBillable:  true,
            });

            setSaveMsg(`✅ ${formatTime(totalSeconds)} registrado en "${timerState.matterTitle}"`);
            clearState();
            setTimerState(DEFAULT_STATE);
            setElapsed(0);
            setExpanded(false);
            setTimeout(() => setSaveMsg(''), 5000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error al guardar el tiempo.');
        } finally {
            setSaving(false);
        }
    };

    const handleDiscard = () => {
        clearState();
        setTimerState(DEFAULT_STATE);
        setElapsed(0);
        setExpanded(false);
        setError('');
        setSaveMsg('');
    };

    const handleMatterChange = (id: string) => {
        const found = matters.find(m => m.id === id);
        setTimerState(prev => ({
            ...prev,
            matterId:    id,
            matterTitle: found?.title ?? '',
        }));
        setError('');
    };

    // ── No mostrar si no hay usuario ──────────────────────────────────────

    if (!user) return null;

    // ── Variables derivadas ───────────────────────────────────────────────

    const isActive    = timerState.isRunning;
    const isPaused    = timerState.isPaused;
    const hasTime     = elapsed > 0;

    const timerColor  = isActive && !isPaused ? '#16a34a'
                      : isPaused              ? '#d97706'
                      :                        '#6366f1';

    const pulseStyle  = isActive && !isPaused ? {
        animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
    } : {};

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9990,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
            fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
            {/* Mensaje de guardado */}
            {saveMsg && (
                <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #86efac',
                    borderRadius: 12,
                    padding: '0.65rem 1rem',
                    fontSize: '0.82rem',
                    color: '#15803d',
                    fontWeight: 600,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxWidth: 280,
                }}>
                    {saveMsg}
                </div>
            )}

            {/* Panel expandido */}
            {!minimized && (
                <div style={{
                    background: '#fff',
                    borderRadius: 18,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
                    width: 300,
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                }}>
                    {/* Timer display */}
                    <div style={{
                        background: `linear-gradient(135deg, ${timerColor}, ${timerColor}cc)`,
                        padding: '1.25rem',
                        textAlign: 'center',
                        position: 'relative',
                    }}>
                        <button
                            onClick={() => setMinimized(true)}
                            style={{
                                position: 'absolute', top: 10, right: 10,
                                background: 'rgba(255,255,255,0.2)', border: 'none',
                                borderRadius: 6, cursor: 'pointer', padding: '2px 6px',
                                color: '#fff',
                            }}
                        >
                            <ChevronDown size={14} />
                        </button>

                        <div style={{ ...pulseStyle, display: 'inline-block' }}>
                            <div style={{
                                fontSize: '2rem', fontWeight: 800, color: '#fff',
                                fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em',
                            }}>
                                {formatTime(elapsed)}
                            </div>
                        </div>

                        {timerState.matterTitle && (
                            <div style={{
                                fontSize: '0.72rem', color: 'rgba(255,255,255,0.85)',
                                marginTop: 4, fontWeight: 600,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {timerState.matterTitle}
                            </div>
                        )}

                        {/* Controles */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12 }}>
                            {!isActive && (
                                <button onClick={handleStart} style={ctrlBtn('#fff', timerColor)}>
                                    <Play size={14} fill={timerColor} />
                                    Iniciar
                                </button>
                            )}
                            {isActive && !isPaused && (
                                <button onClick={handlePause} style={ctrlBtn('#fff', '#d97706')}>
                                    <Pause size={14} fill="#d97706" />
                                    Pausar
                                </button>
                            )}
                            {isActive && isPaused && (
                                <button onClick={handleResume} style={ctrlBtn('#fff', '#16a34a')}>
                                    <Play size={14} fill="#16a34a" />
                                    Reanudar
                                </button>
                            )}
                            {hasTime && (
                                <button
                                    onClick={handleStop}
                                    disabled={saving}
                                    style={ctrlBtn('#fff', '#b91c1c')}
                                >
                                    <StopCircle size={14} color="#b91c1c" />
                                    {saving ? '…' : 'Guardar'}
                                </button>
                            )}
                            {hasTime && (
                                <button onClick={handleDiscard} style={ctrlBtn('#fff', '#94a3b8')}>
                                    <X size={12} color="#94a3b8" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Formulario */}
                    <div style={{ padding: '1rem' }}>
                        <div style={{ marginBottom: '0.75rem' }}>
                            <label style={lbl}>Asunto *</label>
                            <select
                                value={timerState.matterId}
                                onChange={e => handleMatterChange(e.target.value)}
                                disabled={isActive && !isPaused}
                                style={sel}
                            >
                                <option value="">— Selecciona un asunto —</option>
                                {matters.map(m => (
                                    <option key={m.id} value={m.id}>{m.title}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => setExpanded(p => !p)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: '0.75rem', color: '#6366f1', fontWeight: 600,
                                padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                                marginBottom: expanded ? '0.75rem' : 0,
                            }}
                        >
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {expanded ? 'Menos opciones' : 'Categoría y descripción'}
                        </button>

                        {expanded && (
                            <>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <label style={lbl}>Categoría</label>
                                    <select
                                        value={timerState.category}
                                        onChange={e => setTimerState(prev => ({ ...prev, category: e.target.value as TimeCategory }))}
                                        style={sel}
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={lbl}>Descripción</label>
                                    <input
                                        type="text"
                                        placeholder="¿En qué trabajas?"
                                        value={timerState.description}
                                        onChange={e => setTimerState(prev => ({ ...prev, description: e.target.value }))}
                                        style={{ ...sel, fontFamily: 'inherit' }}
                                    />
                                </div>
                            </>
                        )}

                        {error && (
                            <p style={{ color: '#b91c1c', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
                                ⚠️ {error}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Botón minimizado */}
            {minimized && (
                <button
                    onClick={() => { setMinimized(false); setExpanded(false); }}
                    style={{
                        background: timerColor,
                        color: '#fff',
                        border: 'none',
                        borderRadius: 999,
                        padding: '0.7rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        transition: 'transform 0.15s',
                        ...(isActive && !isPaused ? { animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' } : {}),
                    }}
                    title={isActive ? `Timer activo — ${formatTime(elapsed)}` : 'Iniciar registro de tiempo'}
                >
                    {isActive && !isPaused ? (
                        <Clock size={16} />
                    ) : (
                        <Timer size={16} />
                    )}
                    {isActive ? formatTime(elapsed) : 'Timer'}
                    {isActive && (
                        <ChevronUp size={14} style={{ opacity: 0.8 }} />
                    )}
                </button>
            )}
        </div>
    );
};

// ── Estilos inline reutilizables ─────────────────────────────────────────────

function ctrlBtn(bg: string, accent: string): React.CSSProperties {
    return {
        background: bg,
        border: `1.5px solid ${accent}20`,
        borderRadius: 8,
        padding: '0.35rem 0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.75rem',
        fontWeight: 700,
        color: accent,
        cursor: 'pointer',
        transition: 'opacity 0.15s',
    };
}

const lbl: React.CSSProperties = {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.3rem',
};

const sel: React.CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.75rem',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    fontSize: '0.82rem',
    color: '#1e293b',
    outline: 'none',
    boxSizing: 'border-box',
};
