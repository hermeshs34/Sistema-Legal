import React, { useState, useEffect } from 'react';
import { 
    History, User, Calendar, ArrowRight, Activity, 
    FileText, Settings, Shield, Clock, GitBranch, RefreshCw
} from 'lucide-react';
import { auditService, type AuditLog } from './audit.service.ts';

interface AuditTimelineProps {
    entityType?: string;
    entityId?: string;
    showClose?: boolean;
    onClose?: () => void;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ entityType, entityId, showClose, onClose }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await auditService.getByEntity(entityType as any, entityId!);
            setLogs(data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Cargamos logs si hay una entidad específica O si es una consulta global (sin entityId)
        loadLogs();
    }, [entityId, entityType]);

    const formatAction = (action: string) => {
        switch(action.toUpperCase()) {
            case 'CREATE': return { label: 'Creación', color: '#166534', bg: '#f0fdf4' };
            case 'UPDATE': return { label: 'Modificación', color: '#1d4ed8', bg: '#eff6ff' };
            case 'DELETE': return { label: 'Eliminación', color: '#991b1b', bg: '#fef2f2' };
            default: return { label: action, color: '#475569', bg: '#f8fafc' };
        }
    };

    return (
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '600px' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <History size={16} color="#475569" />
                    </div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Historial de Auditoría</h3>
                </div>
                {showClose && (
                    <button onClick={onClose} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>Cerrar</button>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        <RefreshCw size={24} className="animate-spin" style={{ marginBottom: '0.5rem' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>Consultando registros forenses...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        <History size={32} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>No hay registros de cambios para esta consulta</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '11px', top: '5px', bottom: '5px', width: '2px', background: '#f1f5f9' }} />
                        
                        {logs.map((log) => {
                            const actionCfg = formatAction(log.action);
                            const diff = auditService.getDiff(log.oldData, log.newData);
                            
                            return (
                                <div key={log.id} style={{ position: 'relative', paddingLeft: '2.25rem' }}>
                                    <div style={{ position: 'absolute', left: 0, top: '4px', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', border: `2px solid ${actionCfg.color}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Activity size={10} color={actionCfg.color} />
                                    </div>
                                    
                                    <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, background: actionCfg.bg, color: actionCfg.color, padding: '2px 8px', borderRadius: '5px', textTransform: 'uppercase' }}>{actionCfg.label}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(log.createdAt!).toLocaleString()}</span>
                                    </div>

                                    {diff ? (
                                        <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                            {Object.entries(diff).map(([key, val]) => {
                                                const v = val as { old: any; new: any };
                                                return (
                                                    <div key={key} style={{ marginBottom: '0.4rem', fontSize: '0.75rem' }}>
                                                        <span style={{ fontWeight: 700, color: '#475569' }}>{key.toUpperCase()}:</span>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.1rem' }}>
                                                            <span style={{ color: '#991b1b', textDecoration: 'line-through', opacity: 0.7 }}>{String(v.old)}</span>
                                                            <ArrowRight size={10} color="#94a3b8" />
                                                            <span style={{ color: '#166534', fontWeight: 600 }}>{String(v.new)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569' }}>
                                            {log.details?.message || 'Sin detalles de cambios estructurados'}
                                        </p>
                                    )}

                                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <User size={12} color="#94a3b8" />
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>SISTEMA / AUTOMÁTICO</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
