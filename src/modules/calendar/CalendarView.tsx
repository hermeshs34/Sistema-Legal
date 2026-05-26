import React, { useState, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Plus, Clock, MapPin, Filter, Search, Gavel,
    AlertTriangle, Sun, Info,
} from 'lucide-react';
import { calendarService, type CalendarEvent, type JudicialHoliday } from './calendar.service.ts';

const DAYS   = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ── Leyenda de tipos de evento/feriado ───────────────────────────────────────

const LEGEND = [
    { color: '#7c3aed', label: 'Lapso procesal' },
    { color: '#0284c7', label: 'Audiencia' },
    { color: '#059669', label: 'Evento personalizado' },
    { color: '#dc2626', label: 'Feriado nacional' },
    { color: '#d97706', label: 'Receso TSJ (sin despacho)' },
    { color: '#6b7280', label: 'Feriado regional' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date) {
    return a.getDate() === b.getDate() &&
           a.getMonth() === b.getMonth() &&
           a.getFullYear() === b.getFullYear();
}

function getHolidayInfo(day: Date | null, holidays: JudicialHoliday[]): JudicialHoliday[] {
    if (!day) return [];
    return holidays.filter(h => {
        const hDate = new Date(h.holiday_date + 'T00:00:00');
        if (h.is_recurring) {
            return hDate.getDate() === day.getDate() && hDate.getMonth() === day.getMonth();
        }
        return isSameDay(hDate, day);
    });
}

function getHolidayBg(holidays: JudicialHoliday[]): string {
    if (holidays.some(h => h.type === 'judicial'))  return '#fff7ed';  // receso TSJ — naranja claro
    if (holidays.some(h => h.type === 'national'))  return '#fef2f2';  // feriado nacional — rojo claro
    if (holidays.some(h => h.type === 'religious')) return '#fdf4ff';  // religioso — violeta claro
    if (holidays.some(h => h.type === 'regional'))  return '#f0f9ff';  // regional — azul claro
    return 'white';
}

function getHolidayDot(holidays: JudicialHoliday[]): string {
    if (holidays.some(h => h.type === 'judicial'))  return '#d97706';
    if (holidays.some(h => h.type === 'national'))  return '#dc2626';
    if (holidays.some(h => h.type === 'religious')) return '#7c3aed';
    if (holidays.some(h => h.type === 'regional'))  return '#0284c7';
    return '';
}

// ── Panel de detalle de feriados ──────────────────────────────────────────────

const HolidayDetail: React.FC<{ holidays: JudicialHoliday[]; date: Date }> = ({ holidays, date }) => {
    const typeLabel: Record<string, string> = {
        national: 'Nacional', regional: 'Regional', judicial: 'Receso TSJ',
        religious: 'Religioso', custom: 'Personalizado',
    };
    const typeColor: Record<string, string> = {
        national: '#dc2626', regional: '#0284c7', judicial: '#d97706',
        religious: '#7c3aed', custom: '#059669',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {holidays.map((h, i) => (
                <div key={i} style={{
                    padding: '0.6rem 0.8rem', borderRadius: '10px',
                    background: `${typeColor[h.type]}10`,
                    border: `1px solid ${typeColor[h.type]}30`,
                    fontSize: '0.78rem',
                }}>
                    <div style={{ fontWeight: 700, color: typeColor[h.type], marginBottom: '2px' }}>
                        {h.name}
                    </div>
                    <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            padding: '1px 6px', borderRadius: '4px',
                            background: `${typeColor[h.type]}20`, color: typeColor[h.type],
                            fontWeight: 700, fontSize: '0.65rem',
                        }}>{typeLabel[h.type]}</span>
                        {h.notes && <span>· {h.notes}</span>}
                    </div>
                </div>
            ))}
            {holidays.some(h => h.type === 'judicial') && (
                <div style={{
                    padding: '0.5rem 0.75rem', borderRadius: '8px',
                    background: '#fffbeb', border: '1px solid #fcd34d',
                    fontSize: '0.72rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    <AlertTriangle size={12} />
                    Los tribunales no despachan. Los lapsos procesales quedan suspendidos.
                </div>
            )}
        </div>
    );
};

// ── Componente principal ──────────────────────────────────────────────────────

export const CalendarView: React.FC = () => {
    const [currentDate, setCurrentDate]       = useState(new Date());
    const [events, setEvents]                 = useState<CalendarEvent[]>([]);
    const [holidays, setHolidays]             = useState<JudicialHoliday[]>([]);
    const [loading, setLoading]               = useState(true);
    const [selectedEvent, setSelectedEvent]   = useState<CalendarEvent | null>(null);
    const [selectedDay, setSelectedDay]       = useState<Date | null>(null);
    const [showLegend, setShowLegend]         = useState(false);

    useEffect(() => { loadAll(); }, [currentDate]);

    const loadAll = async () => {
        setLoading(true);
        const year  = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const start = new Date(year, month, 1);
        const end   = new Date(year, month + 1, 0);
        try {
            const [evData, hdData] = await Promise.all([
                calendarService.getUnifiedGlobalEvents(start, end),
                calendarService.getHolidays('VE', year),
            ]);
            setEvents(evData);
            setHolidays(hdData);
        } catch (err) {
            console.error('Error cargando calendario:', err);
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date: Date): (Date | null)[] => {
        const year     = date.getFullYear();
        const month    = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const total    = new Date(year, month + 1, 0).getDate();
        const days: (Date | null)[] = Array(firstDay).fill(null);
        for (let i = 1; i <= total; i++) days.push(new Date(year, month, i));
        return days;
    };

    const prevMonth   = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth   = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const isToday     = (day: Date | null) => !!day && isSameDay(day, new Date());
    const isWeekend   = (day: Date | null) => !!day && (day.getDay() === 0 || day.getDay() === 6);

    const getEventsForDay = (day: Date | null): CalendarEvent[] => {
        if (!day) return [];
        return events.filter(e => isSameDay(new Date(e.start), day));
    };

    const selectedHolidays = selectedDay ? getHolidayInfo(selectedDay, holidays) : [];
    const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

    // Estadísticas del mes
    const monthHolidayCount   = getDaysInMonth(currentDate).filter(d => d && getHolidayInfo(d, holidays).length > 0).length;
    const monthJudicialCount  = getDaysInMonth(currentDate).filter(d => d && getHolidayInfo(d, holidays).some(h => h.type === 'judicial')).length;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem', height: 'calc(100vh - 160px)' }}>

            {/* ── Calendario principal ── */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden' }}>

                {/* Cabecera */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--legal-950)' }}>
                            {MONTHS[currentDate.getMonth()]}
                            <small style={{ fontWeight: 400, color: '#94a3b8', marginLeft: '8px' }}>{currentDate.getFullYear()}</small>
                        </h2>
                        <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                            <button onClick={prevMonth} className="cal-nav-btn"><ChevronLeft size={20} /></button>
                            <button onClick={() => setCurrentDate(new Date())} className="cal-nav-btn" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0 0.75rem' }}>HOY</button>
                            <button onClick={nextMonth} className="cal-nav-btn"><ChevronRight size={20} /></button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {/* Indicadores del mes */}
                        {monthHolidayCount > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fca5a5' }}>
                                {monthHolidayCount} feriado{monthHolidayCount > 1 ? 's' : ''}
                            </div>
                        )}
                        {monthJudicialCount > 0 && (
                            <div style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: '#fffbeb', border: '1px solid #fcd34d' }}>
                                {monthJudicialCount} días sin despacho
                            </div>
                        )}
                        <button
                            className="btn-icon"
                            onClick={() => setShowLegend(!showLegend)}
                            title="Leyenda"
                        >
                            <Info size={18} />
                        </button>
                        <button className="btn-icon"><Filter size={18} /></button>
                        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} /> Nuevo Evento
                        </button>
                    </div>
                </div>

                {/* Leyenda (colapsable) */}
                {showLegend && (
                    <div style={{
                        display: 'flex', flexWrap: 'wrap', gap: '0.75rem',
                        padding: '0.75rem 1rem', borderRadius: '10px',
                        background: '#f8fafc', border: '1px solid #e2e8f0',
                        marginBottom: '1rem',
                    }}>
                        {LEGEND.map(l => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#374151', fontWeight: 600 }}>
                                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: l.color }} />
                                {l.label}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Encabezado días */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                        {DAYS.map((d, i) => (
                            <div key={d} style={{
                                textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em',
                                color: (i === 0 || i === 6) ? '#ef4444' : '#94a3b8',
                            }}>{d}</div>
                        ))}
                    </div>

                    {/* Grid días */}
                    <div style={{
                        flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
                        gridAutoRows: '1fr', gap: '1px', background: '#f1f5f9',
                        borderBottomRightRadius: '12px', borderBottomLeftRadius: '12px', overflow: 'hidden',
                    }}>
                        {getDaysInMonth(currentDate).map((day, idx) => {
                            const dayHolidays  = getHolidayInfo(day, holidays);
                            const dayEvents    = getEventsForDay(day);
                            const isHoliday    = dayHolidays.length > 0;
                            const isJudicial   = dayHolidays.some(h => h.type === 'judicial');
                            const bgColor      = isHoliday ? getHolidayBg(dayHolidays) : (isWeekend(day) ? '#fafafa' : 'white');
                            const dotColor     = isHoliday ? getHolidayDot(dayHolidays) : '';
                            const isSelected   = !!day && !!selectedDay && isSameDay(day, selectedDay);

                            return (
                                <div
                                    key={idx}
                                    onClick={() => day && setSelectedDay(isSelected ? null : day)}
                                    style={{
                                        background: bgColor,
                                        padding: '0.4rem',
                                        minHeight: '80px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        cursor: day ? 'pointer' : 'default',
                                        outline: isSelected ? '2px solid #6366f1' : 'none',
                                        outlineOffset: '-2px',
                                        position: 'relative',
                                        transition: 'background 0.15s',
                                    }}
                                >
                                    {day && (
                                        <>
                                            {/* Número + indicadores */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '0.25rem' }}>
                                                <span style={{
                                                    fontSize: '0.8rem', fontWeight: 700,
                                                    color: isToday(day) ? 'white' : isWeekend(day) ? '#ef4444' : '#475569',
                                                    background: isToday(day) ? '#6366f1' : 'transparent',
                                                    width: '22px', height: '22px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    borderRadius: '6px',
                                                }}>
                                                    {day.getDate()}
                                                </span>
                                                {/* Punto de feriado */}
                                                {dotColor && (
                                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                                                )}
                                                {/* Ícono receso TSJ */}
                                                {isJudicial && (
                                                    <Sun size={10} color="#d97706" style={{ flexShrink: 0 }} />
                                                )}
                                            </div>

                                            {/* Nombre de feriado (si hay espacio) */}
                                            {isHoliday && !isJudicial && dayHolidays[0] && (
                                                <div style={{
                                                    fontSize: '0.6rem', fontWeight: 700,
                                                    color: getHolidayDot(dayHolidays),
                                                    lineHeight: 1.2, marginBottom: '2px',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {dayHolidays[0].name.split(' ').slice(0, 3).join(' ')}
                                                </div>
                                            )}
                                            {isJudicial && (
                                                <div style={{
                                                    fontSize: '0.6rem', fontWeight: 700,
                                                    color: '#d97706', lineHeight: 1.2, marginBottom: '2px',
                                                }}>
                                                    Sin despacho
                                                </div>
                                            )}

                                            {/* Eventos */}
                                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                {dayEvents.slice(0, 3).map(ev => (
                                                    <div
                                                        key={ev.id}
                                                        onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                                                        style={{
                                                            padding: '2px 5px', borderRadius: '4px',
                                                            background: `${ev.color}15`, color: ev.color,
                                                            fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                                                            borderLeft: `2px solid ${ev.color}`,
                                                            whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                                                        }}
                                                    >
                                                        {ev.title}
                                                    </div>
                                                ))}
                                                {dayEvents.length > 3 && (
                                                    <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700 }}>
                                                        +{dayEvents.length - 3} más
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Panel lateral ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>

                {/* Detalle del día seleccionado */}
                {selectedDay && (selectedHolidays.length > 0 || selectedDayEvents.length > 0) && (
                    <div className="premium-card" style={{ padding: '1.25rem' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>
                            {selectedDay.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </h4>
                        {selectedHolidays.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                    Feriados / Recesos
                                </div>
                                <HolidayDetail holidays={selectedHolidays} date={selectedDay} />
                            </div>
                        )}
                        {selectedDayEvents.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                    Eventos ({selectedDayEvents.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {selectedDayEvents.map(ev => (
                                        <div key={ev.id}
                                            onClick={() => setSelectedEvent(ev)}
                                            style={{
                                                padding: '0.6rem 0.8rem', borderRadius: '8px', cursor: 'pointer',
                                                background: `${ev.color}10`, borderLeft: `3px solid ${ev.color}`,
                                                fontSize: '0.8rem', fontWeight: 600, color: '#1e293b',
                                            }}
                                        >
                                            {ev.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Próximos eventos */}
                <div className="premium-card" style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                        Próximos Eventos
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {loading ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Cargando agenda...</p>
                        ) : events.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No hay eventos programados.</p>
                        ) : events.slice(0, 6).map(ev => (
                            <div key={ev.id} onClick={() => setSelectedEvent(ev)} style={{
                                display: 'flex', gap: '1rem', borderBottom: '1px solid #f1f5f9',
                                paddingBottom: '1rem', cursor: 'pointer',
                            }}>
                                <div style={{
                                    textAlign: 'center', padding: '0.5rem',
                                    background: `${ev.color}10`, borderRadius: '10px', minWidth: '50px',
                                    border: `1px solid ${ev.color}30`,
                                }}>
                                    <p style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: ev.color }}>
                                        {new Date(ev.start).getDate()}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>
                                        {MONTHS[new Date(ev.start).getMonth()].slice(0, 3)}
                                    </p>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} />
                                        {new Date(ev.start).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detalle del evento seleccionado */}
                {selectedEvent && (
                    <div className="premium-card" style={{ padding: '1.5rem', borderLeft: `4px solid ${selectedEvent.color}`, background: `${selectedEvent.color}05` }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: selectedEvent.color, fontSize: '0.85rem', fontWeight: 800 }}>Detalle del Evento</h4>
                        <p style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>{selectedEvent.title}</p>
                        {selectedEvent.description && (
                            <p style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: '#475569' }}>{selectedEvent.description}</p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> {new Date(selectedEvent.start).toLocaleString('es-VE')}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> {selectedEvent.metadata?.location || 'Sin ubicación'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Gavel size={14} /> {selectedEvent.source}</span>
                        </div>
                        <button onClick={() => setSelectedEvent(null)} className="btn-secondary" style={{ width: '100%', marginTop: '1rem', padding: '0.5rem', fontSize: '0.85rem' }}>
                            Cerrar
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .premium-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                .cal-nav-btn { background: white; border: 1px solid #e2e8f0; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #475569; transition: all 0.2s; }
                .cal-nav-btn:hover { background: #f8fafc; color: #6366f1; border-color: #6366f1; }
                .btn-icon { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; transition: all 0.2s; }
                .btn-icon:hover { background: #eff6ff; color: #3b82f6; }
                .btn-primary { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
                .btn-secondary { background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 700; cursor: pointer; }
            `}</style>
        </div>
    );
};
