import React, { useState, useEffect, useCallback } from 'react';
import { X, FileText, Shield, Download, AlertCircle, CheckCircle2, Clock, MessageSquare, Send, User, PenLine } from 'lucide-react';
import type { Contract } from './types.ts';
import { auditService, type AuditLog } from '../shared/audit.service.ts';
import { authService } from '../../core/auth.service.ts';
import { contractService } from './contract.service.ts';
import { SignaturePanel } from './SignaturePanel.tsx';
import { pdfReportService } from '../shared/pdf-report.service.ts';
import { reportService } from '../shared/report.service.ts';
import { supabase } from '../../core/supabase.ts';

interface ContractDetailsModalProps {
    contract: Contract;
    onClose: () => void;
    onUpdated?: () => void;
}

const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-VE', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const ACTION_LABELS: Record<string, string> = {
    create: 'Creación',
    update: 'Modificación',
    delete: 'Eliminación',
    login: 'Acceso',
    logout: 'Cierre de sesión',
    status_change: 'Cambio de estado',
    comment: 'Comentario agregado',
};

const isReadOnly = (status: string) => ['ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED'].includes(status);

/** Visor seguro: genera signedUrl temporal para archivos en buckets privados */
const SecureDocViewer: React.FC<{ fileUrl: string }> = ({ fileUrl }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        const resolve = async () => {
            // Si ya es una URL pública completa, usarla directamente
            if (fileUrl.startsWith('http')) {
                setSignedUrl(fileUrl);
                return;
            }
            // Generar URL firmada temporal (1 hora)
            const { data, error } = await supabase.storage
                .from('contracts')
                .createSignedUrl(fileUrl, 3600);
            if (error || !data?.signedUrl) {
                setLoadError(true);
                return;
            }
            setSignedUrl(data.signedUrl);
        };
        resolve();
    }, [fileUrl]);

    if (loadError) {
        return (
            <div style={{ height: '100%', minHeight: '600px', background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#64748b' }}>
                <FileText size={40} color="#dc2626" />
                <p style={{ fontWeight: 700 }}>No se pudo cargar el documento</p>
                <p style={{ fontSize: '0.8rem' }}>El archivo puede haber sido eliminado o el acceso ha caducado.</p>
            </div>
        );
    }

    if (!signedUrl) {
        return (
            <div style={{ height: '100%', minHeight: '600px', background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: '#94a3b8', fontWeight: 600 }}>Cargando documento seguro...</p>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', minHeight: '600px', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
            <iframe src={signedUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Visor PDF Seguro" />
        </div>
    );
};

export const ContractDetailsModal: React.FC<ContractDetailsModalProps> = ({ contract, onClose, onUpdated }) => {
    const user = authService.getCurrentUser();
    const [localContract, setLocalContract] = useState<Contract & Record<string, unknown>>(contract as any);
    const [rightPanel, setRightPanel] = useState<'compliance' | 'audit' | 'comments' | 'signature' | 'forensic'>('compliance');
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);
    const [comments, setComments] = useState<AuditLog[]>([]);
    const [newComment, setNewComment] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [downloadingAuditPdf, setDownloadingAuditPdf] = useState(false);

    // Guard DESPUÉS de hooks — cumple las Reglas de Hooks de React
    if (!contract) return null;

    const reloadContract = useCallback(async () => {
        const allContracts = await contractService.getAll();
        const updated = allContracts.find(c => c.id === contract.id);
        if (updated) {
            setLocalContract(prev => {
                // Solo notifica al padre si algo realmente cambió
                if ((prev as any).updated_at !== (updated as any).updated_at) {
                    onUpdated?.();
                }
                return updated as any;
            });
        }
    }, [contract.id]); // onUpdated excluído intencionalmente para evitar loop

    useEffect(() => {
        reloadContract();
    }, [contract.id]); // Solo se dispara cuando cambia el contrato

    const loadAuditLogs = async () => {
        setLoadingAudit(true);
        try {
            const logs = await auditService.getByEntity('contract', localContract.id);
            setAuditLogs(logs.filter(l => l.action !== 'comment'));
            setComments(logs.filter(l => l.action === 'comment'));
        } catch (err) {
            console.error('Error cargando auditoria:', err);
        } finally {
            setLoadingAudit(false);
        }
    };

    useEffect(() => {
        if (rightPanel === 'audit' || rightPanel === 'comments' || rightPanel === 'forensic') {
            loadAuditLogs();
        }
    }, [rightPanel]);

    const handleAddComment = async () => {
        if (!newComment.trim() || !user) return;
        setSavingComment(true);
        try {
            await auditService.log({
                entityType: 'contract',
                entityId: contract.id,
                action: 'comment' as any,
                details: {
                    text: newComment.trim(),
                    author: user.name,
                    role: user.role,
                    contractStatus: contract.status,
                },
                userId: user.id,
                organizationId: user.organizationId,
            });
            setNewComment('');
            await loadAuditLogs();
        } catch (err) {
            console.error('Error al guardar comentario:', err);
        } finally {
            setSavingComment(false);
        }
    };

    const handleDownloadPdf = async () => {
        setDownloadingPdf(true);
        try {
            const logs = await auditService.getByEntity('contract', contract.id);
            await pdfReportService.generateCertifiedContract({
                contract: localContract,
                auditLogs: logs,
                generatedBy: {
                    name: user?.name || 'Sistema',
                    role: user?.role || 'N/A',
                    email: user?.email,
                },
            });
            if (user) {
                await auditService.log({
                    entityType: 'contract',
                    entityId: contract.id,
                    action: 'update',
                    details: { action: 'certified_pdf_exported', reportCode: 'RPT-CONT-001', by: user.name },
                    userId: user.id,
                    organizationId: user.organizationId,
                });
            }
        } catch (err) {
            alert('Error al generar el PDF certificado.');
            console.error(err);
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleDownloadAuditTrail = async () => {
        setDownloadingAuditPdf(true);
        try {
            const logs = await auditService.getByEntity('contract', contract.id);
            await pdfReportService.generateAuditTrail({
                contract: localContract,
                auditLogs: logs,
                generatedBy: {
                    name: user?.name || 'Sistema',
                    role: user?.role || 'N/A',
                    email: user?.email,
                },
            });
            if (user) {
                await auditService.log({
                    entityType: 'contract',
                    entityId: contract.id,
                    action: 'update',
                    details: { action: 'audit_trail_pdf_exported', reportCode: 'RPT-CONT-003', by: user.name },
                    userId: user.id,
                    organizationId: user.organizationId,
                });
            }
        } catch (err) {
            alert('Error al generar la bitácora PDF.');
            console.error(err);
        } finally {
            setDownloadingAuditPdf(false);
        }
    };

    const statusColor = (status: string) => {
        if (status === 'ACTIVE') return '#16a34a';
        if (status === 'REVIEW') return '#d97706';
        if (status === 'DRAFT') return '#6366f1';
        return '#64748b';
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(16px)'
        }}>
            <div style={{
                width: '95%', maxWidth: '1200px', height: '94vh',
                background: '#fff', borderRadius: '32px', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)'
            }}>
                <div style={{
                    padding: '2rem 2.5rem',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    color: '#fff', position: 'relative', flexShrink: 0
                }}>
                    <button onClick={onClose} style={{
                        position: 'absolute', top: '1.25rem', right: '1.25rem',
                        background: 'rgba(255,255,255,0.1)', border: 'none',
                        color: '#fff', borderRadius: '50%', width: '40px', height: '40px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}><X size={20} /></button>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{
                            width: '72px', height: '72px', borderRadius: '20px', flexShrink: 0,
                            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}><FileText size={36} /></div>

                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                <span style={{
                                    padding: '4px 14px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 900,
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                    background: statusColor(contract.status), color: '#fff'
                                }}>{contract.status}</span>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
                                    ID: {contract.id}
                                </span>
                            </div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                                {contract.title}
                            </h2>
                            <button onClick={() => reportService.generateRiesgoContractual()} style={{ marginTop: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(220,38,38,0.3)', color: 'white', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                                <Download size={13} /> R-04 · Riesgo Contractual
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', overflow: 'hidden' }}>
                    <div style={{ overflowY: 'auto', background: '#f1f5f9', padding: '2rem' }}>
                        {localContract.file_url ? (
                            <SecureDocViewer fileUrl={localContract.file_url} />
                        ) : localContract.content_draft ? (
                            <div style={{
                                background: '#fff', padding: '4rem', borderRadius: '8px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                                fontFamily: 'serif', fontSize: '1rem', lineHeight: '1.8', color: '#1e293b'
                            }} dangerouslySetInnerHTML={{ __html: localContract.content_draft }} />
                        ) : (
                            <div style={{
                                background: '#fff', padding: '2.5rem', borderRadius: '16px',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '1.5rem'
                            }}>
                                <div style={{ display: 'flex', gap: '1rem', background: '#fffbeb', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #fcd34d', alignItems: 'flex-start' }}>
                                    <FileText size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: '0.88rem' }}>Ficha del Instrumento</p>
                                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#b45309', lineHeight: 1.5 }}>Documento en redacción / sin adjunto.</p>
                                    </div>
                                </div>
                                {[
                                    ['Título', localContract.title],
                                    ['Categoría', localContract.type],
                                    ['Estado', localContract.status],
                                    ['Descripción', localContract.description || '—'],
                                    ['Inicio', localContract.startDate || '—'],
                                    ['Vencimiento', localContract.endDate || '—'],
                                    ['Valor', localContract.value ? `${localContract.currency} ${localContract.value}` : '—'],
                                ].map(([label, value]) => (
                                    <div key={label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid #f8fafc' }}>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{label}</span>
                                        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155' }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderLeft: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
                            {([
                                { id: 'compliance', label: 'Detalles', icon: <Shield size={14} /> },
                                { id: 'comments', label: 'Social', icon: <MessageSquare size={14} /> },
                                { id: 'signature', label: 'Firma', icon: <PenLine size={14} /> },
                                { id: 'audit', label: 'Bitácora', icon: <Clock size={14} /> },
                                { id: 'forensic', label: 'Forense', icon: <AlertCircle size={14} /> },
                            ] as const).map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setRightPanel(tab.id)}
                                    style={{
                                        padding: '0.875rem 0.5rem', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        fontSize: '0.75rem', fontWeight: 700,
                                        background: rightPanel === tab.id ? '#f8fafc' : '#fff',
                                        color: rightPanel === tab.id ? '#0f172a' : '#94a3b8',
                                        borderBottom: rightPanel === tab.id ? '2px solid #6366f1' : '2px solid transparent'
                                    }}
                                >{tab.icon} {tab.label}</button>
                            ))}
                        </div>

                        {rightPanel === 'compliance' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    <div style={{ padding: '1.25rem', background: '#f0f9ff', borderRadius: '16px', border: '1px solid #e0f2fe' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                                            <CheckCircle2 color="#0284c7" size={20} />
                                            <span style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.88rem' }}>VALIDADO</span>
                                        </div>
                                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#0c4a6e' }}>Instrumento validado por plataforma.</p>
                                    </div>
                                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                                        <h5 style={{ margin: '0 0 1rem', fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Ficha Técnica</h5>
                                        {[
                                            ['Abogado Asignado', localContract.assignedLawyerName || localContract.assignedLawyerId],
                                            ['ID Gestión', localContract.id.substring(0, 8)],
                                            ['Confidencialidad', 'RESERVADA'],
                                        ].map(([label, value]) => (
                                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{label}</span>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={handleDownloadPdf} disabled={downloadingPdf} style={{ width: '100%', padding: '1rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                                        <Download size={18} /> {downloadingPdf ? 'Generando...' : 'PDF CERTIFICADO'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {rightPanel === 'comments' && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                                    {comments.map((c, i) => (
                                        <div key={i} style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid #f1f5f9', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <span style={{ fontWeight: 800, fontSize: '0.82rem' }}><User size={12} /> {(c.details as any)?.author || 'Usuario'}</span>
                                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{formatDate(c.createdAt)}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.88rem' }}>{(c.details as any)?.text}</p>
                                        </div>
                                    ))}
                                </div>
                                {!isReadOnly(localContract.status) && (
                                    <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                        <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Nota legal..." rows={3} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }} />
                                        <button onClick={handleAddComment} disabled={savingComment || !newComment.trim()} style={{ marginTop: '0.5rem', width: '100%', padding: '0.75rem', background: '#6366f1', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 700 }}>
                                            <Send size={16} /> ENVÍAR NOTA
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {rightPanel === 'signature' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
                                <SignaturePanel contract={localContract} onSigned={reloadContract} />
                            </div>
                        )}

                        {rightPanel === 'audit' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <h5 style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800 }}>AUDITORÍA</h5>
                                    <button onClick={handleDownloadAuditTrail} disabled={downloadingAuditPdf} style={{ padding: '4px 10px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.7rem' }}>
                                        PDF
                                    </button>
                                </div>
                                {loadingAudit ? (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '2rem' }}>Cargando bitácora forense...</p>
                                ) : auditLogs.length === 0 ? (
                                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', padding: '2rem' }}>No hay registros de auditoría.</p>
                                ) : (
                                    auditLogs.map((log, i) => (
                                        <div key={i} style={{ borderLeft: '3px solid #6366f1', paddingLeft: '1rem', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                                                <span style={{ fontWeight: 800 }}>{ACTION_LABELS[log.action] || log.action}</span>
                                                <span style={{ color: '#94a3b8' }}>{formatDate(log.createdAt)}</span>
                                            </div>
                                            <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>
                                                {typeof log.details === 'object' ? ((log.details as any)?.message || JSON.stringify(log.details)) : log.details}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {rightPanel === 'forensic' && (
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
                                <h5 style={{ margin: '0 0 1.5rem', fontSize: '0.75rem', fontWeight: 800 }}>🛡️ VERIFICACIÓN SHA-256</h5>
                                
                                {localContract.metadata?.biometric_photo && (
                                    <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '16px', border: '1.5px solid #6366f120', marginBottom: '1.5rem', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#6366f1', marginBottom: '1rem', textTransform: 'uppercase' }}>Identidad Biométrica Sellada</div>
                                        <div style={{ width: '120px', height: '120px', margin: '0 auto', borderRadius: '50%', border: '4px solid #fff', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                            <img src={localContract.metadata.biometric_photo} alt="Firma Biométrica" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ marginTop: '1rem', fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                            Captura vinculada al Hash: <br/>
                                            <code style={{ fontSize: '0.6rem', color: '#16a34a' }}>{localContract.signature_hash?.slice(0, 24)}...</code>
                                        </div>
                                    </div>
                                )}
                                {auditLogs.map((log, i) => (
                                    <div key={i} style={{ padding: '1rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#4338ca', marginBottom: '8px' }}>EVIDENCIA CRIPTOGRÁFICA</div>
                                        <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '8px' }}>
                                            <span style={{ display: 'block', fontSize: '0.55rem', color: '#64748b' }}>CHECKSUM</span>
                                            <code style={{ fontSize: '0.65rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{(log as any).checksum || 'SECURED_EVENT'}</code>
                                        </div>
                                        <div style={{ padding: '8px', background: '#fff', borderRadius: '8px', border: '1px dotted #e2e8f0' }}>
                                            <span style={{ display: 'block', fontSize: '0.55rem', color: '#64748b' }}>CHAIN HASH</span>
                                            <code style={{ fontSize: '0.65rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{(log as any).previous_hash || 'GENESIS'}</code>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ padding: '1.25rem 2.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>🛡️ LEGALDOC VE — FORENSE SHA-256 &nbsp;·&nbsp; 2026</p>
                </div>
            </div>
        </div>
    );
};
