import React, { useState, useEffect } from 'react';
import { 
    ChevronLeft, 
    ChevronRight, 
    Plus, 
    Clock, 
    MapPin, 
    Filter,
    Search,
    Gavel
} from 'lucide-react';
import { calendarService, type CalendarEvent } from './calendar.service.ts';

const DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const CalendarView: React.FC = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    useEffect(() => {
        loadEvents();
    }, [currentDate]);

    const loadEvents = async () => {
        setLoading(true);
        const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        try {
            const data = await calendarService.getUnifiedGlobalEvents(start, end);
            setEvents(data);
        } catch (error) {
            console.error("Error loading events:", error);
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        // Add padding for start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }
        // Add actual days
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const isToday = (date: Date | null) => {
        if (!date) return false;
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    };

    const getEventsForDay = (date: Date | null) => {
        if (!date) return [];
        return events.filter(e => {
            const d = new Date(e.start);
            return d.getDate() === date.getDate() && 
                   d.getMonth() === date.getMonth() && 
                   d.getFullYear() === date.getFullYear();
        });
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem', height: 'calc(100vh - 160px)' }}>
            {/* Main Calendar Section */}
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, color: 'var(--legal-950)' }}>
                            {MONTHS[currentDate.getMonth()]} <small style={{ fontWeight: 400, color: '#94a3b8' }}>{currentDate.getFullYear()}</small>
                        </h2>
                        <div style={{ display: 'flex', gap: '0.25rem', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                            <button onClick={prevMonth} className="cal-nav-btn"><ChevronLeft size={20} /></button>
                            <button onClick={() => setCurrentDate(new Date())} className="cal-nav-btn" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0 0.75rem' }}>HOY</button>
                            <button onClick={nextMonth} className="cal-nav-btn"><ChevronRight size={20} /></button>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn-icon"><Filter size={18} /></button>
                        <button className="btn-icon"><Search size={18} /></button>
                        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} /> Nuevo Evento
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* Days Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>{d}</div>
                        ))}
                    </div>

                    {/* Grid */}
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridTemplateRows: 'repeat(5, 1fr)', gap: '1px', background: '#f1f5f9', borderBottomRightRadius: '12px', borderBottomLeftRadius: '12px', overflow: 'hidden' }}>
                        {getDaysInMonth(currentDate).map((day, idx) => (
                            <div key={idx} style={{ background: 'white', padding: '0.5rem', minHeight: '100px', display: 'flex', flexDirection: 'column' }}>
                                {day && (
                                    <>
                                        <span style={{ 
                                            fontSize: '0.875rem', 
                                            fontWeight: 700, 
                                            color: isToday(day) ? 'white' : '#64748b',
                                            background: isToday(day) ? '#6366f1' : 'transparent',
                                            width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px',
                                            marginBottom: '0.5rem'
                                        }}>
                                            {day.getDate()}
                                        </span>
                                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {getEventsForDay(day).map(ev => (
                                                <div 
                                                    key={ev.id} 
                                                    onClick={() => setSelectedEvent(ev)}
                                                    style={{ 
                                                        padding: '4px 6px', 
                                                        borderRadius: '4px', 
                                                        background: `${ev.color}15`, 
                                                        color: ev.color, 
                                                        fontSize: '0.7rem', 
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        borderLeft: `3px solid ${ev.color}`,
                                                        whiteSpace: 'nowrap',
                                                        textOverflow: 'ellipsis',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {ev.title}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Side Info Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="premium-card" style={{ padding: '1.5rem', flex: 1 }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 800 }}>Próximos Eventos</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {loading ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Cargando agenda...</p>
                        ) : events.length === 0 ? (
                            <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No hay eventos programados.</p>
                        ) : (
                            events.slice(0, 5).map(ev => (
                                <div key={ev.id} style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                                    <div style={{ textAlign: 'center', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px', minWidth: '50px' }}>
                                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#1e293b' }}>{new Date(ev.start).getDate()}</p>
                                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>{MONTHS[new Date(ev.start).getMonth()].slice(0, 3)}</p>
                                    </div>
                                    <div>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', fontWeight: 700 }}>{ev.title}</p>
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={12} /> {new Date(ev.start).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {selectedEvent && (
                    <div className="premium-card" style={{ padding: '1.5rem', borderLeft: `4px solid ${selectedEvent.color}`, background: `${selectedEvent.color}05` }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: selectedEvent.color }}>Detalle del Evento</h4>
                        <p style={{ margin: '0 0 0.75rem 0', fontWeight: 800 }}>{selectedEvent.title}</p>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#475569' }}>{selectedEvent.description}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> {new Date(selectedEvent.start).toLocaleString()}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={14} /> {selectedEvent.metadata?.location || 'Sin ubicación'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Gavel size={14} /> {selectedEvent.source}</span>
                        </div>
                        <button onClick={() => setSelectedEvent(null)} className="btn-secondary" style={{ width: '100%', marginTop: '1rem', padding: '0.5rem' }}>Cerrar</button>
                    </div>
                )}
            </div>

            <style>{`
                .premium-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
                .cal-nav-btn { background: white; border: 1px solid #e2e8f0; border-radius: 8px; width: 32px; height: 32px; display: flex; alignItems: center; justifyContent: center; cursor: pointer; color: #475569; transition: all 0.2s; }
                .cal-nav-btn:hover { background: #f8fafc; color: #6366f1; border-color: #6366f1; }
                .btn-icon { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; width: 44px; height: 44px; display: flex; alignItems: center; justifyContent: center; cursor: pointer; color: #64748b; }
                .btn-primary { background: #6366f1; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
                .btn-secondary { background: white; color: #475569; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 700; cursor: pointer; }
            `}</style>
        </div>
    );
};
