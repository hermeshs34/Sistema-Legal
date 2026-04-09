import React, { useState } from 'react';
import { 
    Clock, 
    FileText, 
    CheckCircle, 
    AlertCircle, 
    ExternalLink, 
    Download, 
    Pencil, 
    Trash2, 
    Paperclip,
    ArrowRight
} from 'lucide-react';
import type { Actuacion, ActuacionStatus } from './types.ts';
import { TIPO_ACTUACION_LABELS } from './types.ts';
import { supabase } from '../../core/supabase.ts';

interface Props {
    actuaciones: Actuacion[];
    onEdit: (act: Actuacion) => void;
    onDelete: (id: string) => void;
    canDelete?: boolean;
}

const STATUS_STYLE: Record<ActuacionStatus, { color: string; bg: string; icon: any }> = {
    PENDIENTE:  { color: '#d97706', bg: '#fffbeb', icon: Clock },
    REALIZADA:  { color: '#059669', bg: '#f0fdf4', icon: CheckCircle },
    SUSPENDIDA: { color: '#dc2626', bg: '#fef2f2', icon: AlertCircle },
    DIFERIDA:   { color: '#6366f1', bg: '#f5f3ff', icon: Clock },
};

export const ActuacionesTimeline: React.FC<Props> = ({ actuaciones, onEdit, onDelete, canDelete }) => {
    const [downloading, setDownloading] = useState<string | null>(null);

    const handleDownload = async (filePath: string) => {
        setDownloading(filePath);
        try {
            const { data, error } = await supabase.storage
                .from('legal-documents')
                .createSignedUrl(filePath, 60);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (err) {
            console.error('Download error:', err);
            alert('No se pudo acceder al archivo.');
        } finally {
            setDownloading(null);
        }
    };

    if (actuaciones.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '32px', border: '2px dashed #e2e8f0' }}>
                <FileText size={48} color="#cbd5e1" style={{ marginBottom: '1.5rem' }} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#64748b' }}>Sin actuaciones registradas</h3>
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#94a3b8' }}>Comience registrando el hito inicial del proceso.</p>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', paddingLeft: '2.5rem' }}>
            {/* Vertical Line */}
            <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '10px', width: '2px', background: 'linear-gradient(to bottom, #e2e8f0 0%, #e2e8f0 80%, transparent 100%)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {actuaciones.map((act, idx) => {
                    const status = STATUS_STYLE[act.status || 'REALIZADA'];
                    const StatusIcon = status.icon;
                    const date = new Date(act.fecha);

                    return (
                        <div key={act.id} style={{ position: 'relative' }}>
                            {/* Dot */}
                            <div style={{ 
                                position: 'absolute', left: '-35px', top: '4px', 
                                width: '20px', height: '20px', borderRadius: '50%', 
                                background: status.bg, border: `3px solid ${status.color}`,
                                zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 0 4px white'
                            }}>
                                <StatusIcon size={8} color={status.color} fill={status.color} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {/* Date and Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {date.toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </span>
                                        <span style={{ padding: '3px 10px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontSize: '0.65rem', fontWeight: 800 }}>
                                            {TIPO_ACTUACION_LABELS[act.tipo]}
                                        </span>
                                        <span style={{ padding: '3px 10px', borderRadius: '20px', background: status.bg, color: status.color, fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase' }}>
                                            {act.status}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => onEdit(act)} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer' }}><Pencil size={14} /></button>
                                        {canDelete && <button onClick={() => onDelete(act.id)} style={{ padding: '6px', borderRadius: '8px', border: '1px solid #fee2e2', background: 'white', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>}
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className="timeline-card" style={{ 
                                    background: 'white', padding: '1.25rem 1.5rem', borderRadius: '20px', 
                                    border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <p style={{ margin: 0, fontSize: '0.98rem', lineHeight: 1.6, color: '#1e293b', fontWeight: 500 }}>
                                        {act.descripcion}
                                    </p>

                                    {(act.resultado || act.proximoPaso) && (
                                        <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px dashed #f1f5f9', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                            {act.resultado && (
                                                <div>
                                                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Resultado / Impacto</label>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>{act.resultado}</p>
                                                </div>
                                            )}
                                            {act.proximoPaso && (
                                                <div>
                                                    <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Siguiente Paso</label>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#6366f1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <ArrowRight size={14} /> {act.proximoPaso}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {act.archivoUrl && (
                                        <div style={{ marginTop: '1.25rem' }}>
                                            <button 
                                                onClick={() => handleDownload(act.archivoUrl!)}
                                                disabled={downloading === act.archivoUrl}
                                                style={{ 
                                                    display: 'flex', alignItems: 'center', gap: '8px', 
                                                    padding: '0.5rem 1rem', background: '#f8fafc', 
                                                    border: '1px solid #e2e8f0', borderRadius: '10px', 
                                                    fontSize: '0.75rem', fontWeight: 700, color: '#475569', 
                                                    cursor: 'pointer', transition: 'all 0.2s' 
                                                }}
                                            >
                                                <Paperclip size={14} />
                                                {downloading === act.archivoUrl ? 'Generando acceso...' : 'Ver Documento Adjunto'}
                                                <Download size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                .timeline-card:hover { transform: translateX(8px); border-color: #6366f130; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.04); }
            `}</style>
        </div>
    );
};
