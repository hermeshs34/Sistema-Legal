import React, { useState, useEffect } from 'react';
import {
    FileText, Search, Filter, Plus, AlertTriangle, Edit, History, ChevronRight, Loader2, Check, X, Shield, Clock, Globe, Download, Brain, Info, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { DocumentAnalysisModal } from './DocumentAnalysisModal.tsx';
import type { Document, DocumentFilter } from './types.ts';
import { DocumentType, DocumentStatus, RiskLevel } from './types.ts';
import { documentService } from './documents.service.ts';
import { lawyerService } from '../legal-team/lawyers.service.ts';
import { auditService, type AuditLog } from '../shared/audit.service.ts';
import { workflowService, type DocumentApproval } from './workflow.service.ts';
import { i18nService } from '../shared/i18n.service.ts';
import { DocumentForm } from './DocumentForm.tsx';
import type { User as AppUser } from '../../core/user.types.ts';

interface DocumentListViewProps {
    user: AppUser;
}

export const DocumentListView: React.FC<DocumentListViewProps> = ({ user }) => {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [filter, setFilter] = useState<DocumentFilter>({});

    const [lawyers, setLawyers] = useState<any[]>([]);

    // Modal / Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<Document | undefined>(undefined);
    const [auditDoc, setAuditDoc] = useState<Document | undefined>(undefined);
    const [analysisDoc, setAnalysisDoc] = useState<Document | undefined>(undefined);

    // Refresh data
    const loadDocuments = async () => {
        const data = await documentService.getAll(filter);
        setDocuments(data);
    };

    const loadLawyers = async () => {
        const data = await lawyerService.getAll();
        setLawyers(data);
    };

    useEffect(() => {
        loadDocuments();
    }, [filter]);

    useEffect(() => {
        loadLawyers();
    }, []);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter({ ...filter, search: e.target.value });
    };

    const handleCreate = () => {
        setEditingDoc(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (doc: Document) => {
        setEditingDoc(doc);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este documento? Esta acción no se puede deshacer y borrará también el historial de auditoría asociado.')) {
            return;
        }

        try {
            await documentService.delete(id);
            await loadDocuments();
            alert('Documento eliminado correctamente.');
        } catch (err) {
            console.error('Error deleting document:', err);
            alert('Error al eliminar el documento.');
        }
    };

    const handleDownload = async (path: string) => {
        if (!path) return;
        
        let storagePath = path;

        // Si es una URL completa de Supabase Storage, extraer path relativo
        if (path.startsWith('http')) {
            const m = path.match(/\/storage\/v1\/object\/public\/legal-documents\/(.+)$/);
            if (m) {
                storagePath = decodeURIComponent(m[1]);
            } else {
                // URL externa no-Supabase, abrir directo
                window.open(path, '_blank');
                return;
            }
        }

        try {
            const signedUrl = await documentService.getDownloadUrl(storagePath);
            if (signedUrl) {
                window.open(signedUrl, '_blank');
            } else {
                alert('No se pudo generar el enlace de descarga. Verifique que el archivo exista en el almacenamiento.');
            }
        } catch (err) {
            console.error('Error in download:', err);
            alert('Error al procesar la descarga.');
        }
    };

    const handleSave = async () => {
        await loadDocuments();
        setIsFormOpen(false);
    };

    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoadingAudit, setIsLoadingAudit] = useState(false);
    const [documentApprovals, setDocumentApprovals] = useState<DocumentApproval[]>([]);

    const handleViewAudit = async (doc: Document) => {
        setAuditDoc(doc);
        setIsLoadingAudit(true);
        const [logs, approvals] = await Promise.all([
            auditService.getByEntity('document', doc.id),
            workflowService.getByDocument(doc.id)
        ]);
        setAuditLogs(logs);
        setDocumentApprovals(approvals);
        setIsLoadingAudit(false);
    };

    const handleApproveStep = async (stepId: string) => {
        if (!auditDoc) return;
        try {
            await workflowService.updateStatus(stepId, 'APPROVED', 'Aprobado desde el panel de revisión');

            // Si era el último paso, podríamos marcar el documento como aprobado
            // Por simplicidad en este MVP, si se aprueba el paso se recarga la data
            await handleViewAudit(auditDoc);
            await loadDocuments();
        } catch (err) {
            alert('Error al aprobar el paso');
        }
    };

    const handleRejectStep = async (stepId: string) => {
        if (!auditDoc) return;
        const reason = prompt('Motivo del rechazo:');
        if (!reason) return;
        try {
            await workflowService.updateStatus(stepId, 'REJECTED', reason);
            await handleViewAudit(auditDoc);
            await loadDocuments();
        } catch (err) {
            alert('Error al rechazar el paso');
        }
    };

    // RBAC: Only Senior, General, Principal can create/edit documents
    const canModify = ['consultor_general', 'abogado_senior', 'consultor_principal'].includes(user.role);

    const [showGuide, setShowGuide] = useState(false);

    const getStatusBadgeStyles = (status: DocumentStatus) => {
        switch (status) {
            case DocumentStatus.APPROVED:
            case DocumentStatus.PUBLISHED:
                return { bg: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5' };
            case DocumentStatus.EXPIRED:
            case DocumentStatus.ARCHIVED:
                return { bg: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' };
            case DocumentStatus.DRAFT:
            case DocumentStatus.IN_REVIEW:
                return { bg: '#fff7ed', color: '#d97706', border: '1px solid #ffedd5' };
            default:
                return { bg: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };
        }
    };

    const getRiskColor = (risk: RiskLevel) => {
        switch (risk) {
            case RiskLevel.CRITICAL: return '#dc2626';
            case RiskLevel.HIGH: return '#ea580c';
            case RiskLevel.MEDIUM: return '#ca8a04';
            case RiskLevel.LOW: return '#16a34a';
            default: return '#94a3b8';
        }
    };


    return (
        <div className="space-y-6" style={{ fontFamily: 'var(--font-body)' }}>

            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.025em' }}>Gestión Documental</h2>
                    <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Repositorio centralizado de expedientes legales y regulatorios.</p>
                </div>
                {canModify && (
                    <button
                        className="btn-primary"
                        onClick={handleCreate}
                        style={{
                            background: 'var(--legal-900)',
                            boxShadow: '0 4px 6px -1px rgba(30, 58, 138, 0.2)',
                            padding: '0.75rem 1.25rem'
                        }}
                    >
                        <Plus size={20} />
                        Nuevo Documento
                    </button>
                )}
            </div>

            {/* Guía de uso del módulo */}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '14px', overflow: 'hidden' }}>
                <button
                    onClick={() => setShowGuide(!showGuide)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.875rem 1.25rem', border: 'none', background: 'transparent', cursor: 'pointer',
                        color: '#0369a1', fontWeight: 700, fontSize: '0.85rem'
                    }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={16} /> ¿Qué documentos se registran aquí? — Guía rápida
                    </span>
                    {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showGuide && (
                    <div style={{ padding: '0 1.25rem 1.25rem', fontSize: '0.82rem', color: '#0c4a6e', lineHeight: 1.6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid #e0f2fe' }}>
                                <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#0284c7', fontSize: '0.78rem' }}>✅ SÍ VA AQUÍ</p>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <li>Políticas internas de la empresa</li>
                                    <li>Normativas y regulaciones (SUNDDE, SENIAT, LOTTT)</li>
                                    <li>Opiniones legales y dictámenes</li>
                                    <li>Evidencias para compliance</li>
                                    <li>Permisos, licencias, circulares</li>
                                    <li>Contratos archivados como evidencia</li>
                                </ul>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid #e0f2fe' }}>
                                <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#dc2626', fontSize: '0.78rem' }}>❌ NO VA AQUÍ</p>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <li>Contratos activos con partes, montos y fechas → usar <strong>módulo Contratos</strong></li>
                                    <li>Acuerdos en negociación → usar <strong>módulo Contratos</strong></li>
                                </ul>
                                <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    💡 <strong>Diferencia clave:</strong> Si el documento implica un <em>acuerdo entre dos partes</em> con obligaciones, va en Contratos. Si es una referencia legal o evidencia, va aquí.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Filters Bar */}
            <div className="premium-card" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', borderRadius: '16px', background: '#fff' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '320px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Buscar por título, ID o contenido..."
                        style={{
                            width: '100%', padding: '0.875rem 1rem 0.875rem 3.5rem',
                            borderRadius: '12px', border: '1px solid #e2e8f0',
                            background: '#f8fafc', fontSize: '0.95rem',
                            outline: 'none', transition: 'all 0.2s'
                        }}
                        onFocus={(e) => { e.target.style.background = '#fff'; e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                        onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                        onChange={handleSearch}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <Filter size={20} color="#64748b" style={{ marginRight: '0.5rem' }} />
                    <select
                        style={{
                            padding: '0.875rem 2.5rem 0.875rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                            background: '#fff', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', appearance: 'none',
                            backgroundImage: 'url(\'data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\')',
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.65em auto'
                        }}
                        onChange={(e) => setFilter({ ...filter, type: e.target.value as DocumentType || undefined })}
                    >
                        <option value="">Tipo: Todos</option>
                        {Object.values(DocumentType).map(t => (
                            <option key={t} value={t}>{t.toUpperCase().replace('_', ' ')}</option>
                        ))}
                    </select>

                    <select
                        style={{
                            padding: '0.875rem 2.5rem 0.875rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                            background: '#fff', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', appearance: 'none',
                            backgroundImage: 'url(\'data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\')',
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.65em auto'
                        }}
                        onChange={(e) => setFilter({ ...filter, riskLevel: e.target.value as RiskLevel || undefined })}
                    >
                        <option value="">Riesgo: Todos</option>
                        {Object.values(RiskLevel).map(r => (
                            <option key={r} value={r}>{r.toUpperCase()}</option>
                        ))}
                    </select>

                    <select
                        style={{
                            padding: '0.875rem 2.5rem 0.875rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0',
                            background: '#fff', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', appearance: 'none',
                            backgroundImage: 'url(\'data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23131313%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E\')',
                            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.65em auto'
                        }}
                        onChange={(e) => setFilter({ ...filter, assignedTo: e.target.value || undefined })}
                    >
                        <option value="">Responsable: Todos</option>
                        {lawyers.map(l => (
                            <option key={l.id} value={l.name}>{l.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Documents Table */}
            <div className="premium-card" style={{ overflow: 'hidden', borderRadius: '16px', border: '1px solid #e2e8f0', background: '#fff' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead style={{ background: '#f8fafc' }}>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Documento</th>
                            <th style={{ textAlign: 'left', padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Metadatos</th>
                            <th style={{ textAlign: 'left', padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Fecha</th>
                            <th style={{ textAlign: 'left', padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Responsable</th>
                            <th style={{ textAlign: 'left', padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Vencimiento</th>
                            <th style={{ textAlign: 'left', padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Estado</th>
                            <th style={{ textAlign: 'right', padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {documents.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                        <Search size={48} strokeWidth={1} style={{ opacity: 0.5 }} />
                                        <p>No se encontraron documentos con los filtros actuales.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : documents.map(doc => (
                            <tr key={doc.id} style={{
                                borderBottom: '1px solid #f1f5f9',
                                transition: 'background 0.15s ease'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            padding: '12px', borderRadius: '12px',
                                            background: '#eff6ff', color: '#2563eb',
                                            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)'
                                        }}>
                                            <FileText size={24} strokeWidth={1.5} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>{doc.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                                                {doc.id} • v{doc.version}
                                            </div>
                                            {doc.region && (
                                                <div style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    marginTop: '6px', padding: '2px 8px', borderRadius: '4px',
                                                    background: doc.region === 'internacional' ? '#f0f9ff' : '#f0fdf4',
                                                    color: doc.region === 'internacional' ? '#0369a1' : '#15803d',
                                                    fontSize: '0.7rem', fontWeight: 700, border: '1px solid currentColor'
                                                }}>
                                                    <Globe size={10} />
                                                    {doc.region.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                                        {doc.metadata.linkedEntity ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{
                                                    fontSize: '0.75rem', fontWeight: 600,
                                                    background: '#f8fafc', padding: '2px 8px', borderRadius: '6px',
                                                    border: '1px solid #e2e8f0', color: '#475569'
                                                }}>
                                                    {doc.metadata.linkedEntity}
                                                </span>
                                            </div>
                                        ) : <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Sin vinculación</span>}

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {doc.metadata.regulatoryBody && (
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{doc.metadata.regulatoryBody}</span>
                                            )}
                                            <span style={{ color: '#cbd5e1' }}>•</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: getRiskColor(doc.riskLevel) }}>
                                                <AlertTriangle size={14} />
                                                <span style={{ fontWeight: 600 }}>{doc.riskLevel.toUpperCase()}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                                        {i18nService.formatDate(doc.createdAt)}
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                            {doc.assignedTo?.charAt(0) || '?'}
                                        </div>
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>{doc.assignedTo || 'Sin asignar'}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    {doc.metadata.expirationDate ? (
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            color: new Date(doc.metadata.expirationDate) < new Date() ? '#ef4444' : '#64748b',
                                            fontSize: '0.8rem', fontWeight: 600
                                        }}>
                                            <Clock size={14} />
                                            {i18nService.formatDate(doc.metadata.expirationDate)}
                                        </div>
                                    ) : '-'}
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                                    {(() => {
                                        const style = getStatusBadgeStyles(doc.status);
                                        return (
                                            <span style={{
                                                background: style.bg, color: style.color, border: style.border,
                                                padding: '0.25rem 0.75rem', borderRadius: '999px',
                                                fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em'
                                            }}>
                                                {doc.status.replace('_', ' ')}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                        <button
                                            className="btn-ghost"
                                            title="Historial"
                                            onClick={() => handleViewAudit(doc)}
                                            style={{ padding: '8px', color: '#64748b', borderRadius: '8px', transition: 'all 0.2s' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#334155'; }}
                                        >
                                            <History size={18} />
                                        </button>
                                        {doc.fileUrl && (
                                            <button
                                                onClick={() => handleDownload(doc.fileUrl!)}
                                                className="btn-ghost"
                                                title="Descargar Archivo"
                                                style={{ padding: '8px', color: '#10b981', borderRadius: '8px' }}
                                            >
                                                <Download size={18} />
                                            </button>
                                        )}
                                        <button
                                            className="btn-ghost"
                                            title="Análisis IA"
                                            onClick={() => setAnalysisDoc(doc)}
                                            style={{ padding: '8px', color: '#8b5cf6', borderRadius: '8px', background: '#f5f3ff' }}
                                        >
                                            <Brain size={18} />
                                        </button>
                                        {canModify && (
                                            <>
                                                <button
                                                    className="btn-ghost"
                                                    title="Editar"
                                                    onClick={() => handleEdit(doc)}
                                                    style={{ padding: '8px', color: '#3b82f6', borderRadius: '8px' }}
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    className="btn-ghost"
                                                    title="Eliminar"
                                                    onClick={() => handleDelete(doc.id)}
                                                    style={{ padding: '8px', color: '#ef4444', borderRadius: '8px' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                        <button style={{ padding: '8px', color: '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <DocumentForm
                    initialData={editingDoc}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                />
            )}

            {/* AI Analysis Modal */}
            {analysisDoc && (
                <DocumentAnalysisModal
                    document={analysisDoc}
                    onClose={() => setAnalysisDoc(undefined)}
                />
            )}

            {/* Audit Log Modal */}
            {auditDoc && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 110,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        width: '100%', maxWidth: '650px', maxHeight: '80vh',
                        background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden'
                    }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <History size={20} color="#3b82f6" />
                                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Historial y Aprobaciones</h3>
                            </div>
                            <button onClick={() => setAuditDoc(undefined)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                        </div>

                        {/* Approval Section */}
                        {documentApprovals.length > 0 && (
                            <div style={{ padding: '1.5rem', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#92400e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Shield size={16} /> Flujo de Aprobación
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {documentApprovals.map((step: DocumentApproval) => (
                                        <div key={step.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#fff', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{step.stepName}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#b45309' }}>Requisito: {step.assignedRole} • {step.status}</div>
                                            </div>
                                            {step.status === 'PENDING' && (user.role === step.assignedRole || user.role === 'consultor_general') && (
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => handleApproveStep(step.id!)} style={{ padding: '4px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Check size={14} /> Aprobar
                                                    </button>
                                                    <button onClick={() => handleRejectStep(step.id!)} style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <X size={14} /> Rechazar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{ padding: '0', overflowY: 'auto' }}>
                            {isLoadingAudit ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    <Loader2 className="animate-spin" style={{ margin: '0 auto 1rem' }} />
                                    <p>Cargando historial...</p>
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    No hay registros de auditoría disponibles para este documento.
                                </div>
                            ) : (
                                <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
                                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <tr style={{ color: '#64748b', textAlign: 'left', fontWeight: 600 }}>
                                            <th style={{ padding: '1rem' }}>Fecha/Hora</th>
                                            <th style={{ padding: '1rem' }}>Acción</th>
                                            <th style={{ padding: '1rem' }}>Detalle</th>
                                            <th style={{ padding: '1rem' }}>Usuario ID</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLogs.map((log: AuditLog) => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '1rem', color: '#334155' }}>
                                                    {log.createdAt ? i18nService.formatDateTime(log.createdAt) : 'N/A'}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{
                                                        textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                                        background: log.action === 'create' ? '#dcfce7' : log.action === 'delete' ? '#fee2e2' : '#eff6ff',
                                                        color: log.action === 'create' ? '#166534' : log.action === 'delete' ? '#991b1b' : '#1e40af'
                                                    }}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', color: '#64748b' }}>
                                                    {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                                                </td>
                                                <td style={{ padding: '1rem', fontSize: '0.75rem', color: '#94a3b8' }}>{log.userId}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
