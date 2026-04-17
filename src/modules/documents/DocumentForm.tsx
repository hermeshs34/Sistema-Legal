import React, { useState, useEffect } from 'react';
import { X, Save, FileText, Shield, AlertTriangle, User, Calendar, Building2, MapPin, Tag, Globe, Upload, File } from 'lucide-react';
import type { Document } from './types.ts';
import { DocumentType, DocumentStatus, RiskLevel } from './types.ts';
import { documentService } from './documents.service.ts';
import { lawyerService } from '../legal-team/lawyers.service.ts';
import { authService } from '../../core/auth.service.ts';
import { workflowService } from './workflow.service.ts';

interface DocumentFormProps {
    initialData?: Document;
    onClose: () => void;
    onSave: () => void;
}

export const DocumentForm: React.FC<DocumentFormProps> = ({ initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Document>>({
        title: '',
        type: DocumentType.CONTRACT,
        status: DocumentStatus.DRAFT,
        riskLevel: RiskLevel.LOW,
        version: '1.0',
        description: '',
        assignedTo: '',
        metadata: {
            regulatoryBody: '',
            expirationDate: '',
            jurisdiction: '',
            linkedEntity: '',
            tags: []
        }
    });

    const [lawyers, setLawyers] = useState<any[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        const loadLawyers = async () => {
            const data = await lawyerService.getAll();
            setLawyers(data);
        };
        loadLawyers();
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (field: keyof Document, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleMetadataChange = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            metadata: { ...prev.metadata, [field]: value }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title || !formData.description) {
            alert('Por favor complete título y descripción');
            return;
        }

        const docToSave: Document = {
            id: initialData?.id || documentService.generateId(),
            title: formData.title,
            description: formData.description,
            type: formData.type || DocumentType.CONTRACT,
            status: formData.status || DocumentStatus.DRAFT,
            riskLevel: formData.riskLevel || RiskLevel.LOW,
            version: formData.version || '1.0',
            assignedTo: formData.assignedTo,
            createdAt: initialData?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            metadata: formData.metadata || {},
            region: formData.region || 'nacional',
            fileUrl: formData.fileUrl,
            createdBy: initialData?.createdBy || authService.getCurrentUser()?.id
        };

        try {
            setUploading(true);

            // Upload file if selected
            if (selectedFile) {
                const path = `${docToSave.id}/${selectedFile.name}`;
                const publicUrl = await documentService.uploadFile(selectedFile, path);
                docToSave.fileUrl = publicUrl;
            }

            await documentService.save(docToSave);

            // Si es un documento nuevo y está en REVIEW, crear el paso de aprobación
            if (!initialData && docToSave.status === DocumentStatus.IN_REVIEW) {
                await workflowService.createStep({
                    documentId: docToSave.id,
                    stepName: 'Revisión Legal Inicial',
                    status: 'PENDING',
                    assignedRole: 'abogado_senior'
                });
            }

            onSave();
        } catch (error) {
            console.error('Error saving document:', error);
            alert('Error al guardar el documento');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div className="premium-card" style={{
                width: '100%', maxWidth: '850px', maxHeight: '92vh',
                display: 'flex', flexDirection: 'column',
                padding: 0, borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
                background: '#fff',
                animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                {/* Premium Header with Gradient */}
                <div style={{
                    padding: '2rem 2.5rem',
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 50%, #4c1d95 100%)',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {/* Decorative Elements */}
                    <div style={{
                        position: 'absolute',
                        top: '-50%',
                        right: '-10%',
                        width: '300px',
                        height: '300px',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
                        borderRadius: '50%',
                        pointerEvents: 'none'
                    }} />

                    <button onClick={onClose} style={{
                        position: 'absolute', top: '1.5rem', right: '1.5rem',
                        border: 'none', background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '50%', color: '#fff', padding: '10px',
                        cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                    >
                        <X size={20} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            padding: '1rem',
                            background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                        }}>
                            <FileText size={32} strokeWidth={2} />
                        </div>
                        <div>
                            <h2 style={{
                                fontSize: '1.75rem',
                                fontWeight: 800,
                                margin: 0,
                                letterSpacing: '-0.025em',
                                textShadow: '0 2px 10px rgba(0,0,0,0.1)'
                            }}>
                                {initialData ? 'Actualizar Documento' : 'Nuevo Expediente Legal'}
                            </h2>
                            <p style={{
                                fontSize: '0.95rem',
                                margin: '6px 0 0 0',
                                opacity: 0.9,
                                fontWeight: 500
                            }}>
                                {initialData ? `Modificando: ${initialData.id}` : 'Registro de nueva documentación en el sistema'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body with Modern Scroll */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '2.5rem',
                    background: 'linear-gradient(to bottom, #fafbfc 0%, #fff 100%)'
                }}>
                    <form id="document-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '2rem' }}>

                        {/* Section 1: Core Information */}
                        <div style={{
                            padding: '2rem',
                            background: '#fff',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02)'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                marginBottom: '1.5rem',
                                paddingBottom: '1rem',
                                borderBottom: '2px solid #f1f5f9'
                            }}>
                                <div style={{
                                    padding: '8px',
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    borderRadius: '12px',
                                    color: '#fff'
                                }}>
                                    <FileText size={20} />
                                </div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    margin: 0,
                                    letterSpacing: '-0.01em'
                                }}>
                                    Información Principal
                                </h3>
                            </div>

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: '#475569',
                                        marginBottom: '0.5rem',
                                        letterSpacing: '0.01em'
                                    }}>
                                        Título del Documento <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem',
                                            fontSize: '1rem',
                                            borderRadius: '12px',
                                            border: '2px solid #e2e8f0',
                                            transition: 'all 0.2s'
                                        }}
                                        value={formData.title}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                        placeholder="Ej. Contrato Marco de Prestación de Servicios 2024"
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <Globe size={14} /> Región
                                        </label>
                                        <select
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '0.95rem',
                                                fontWeight: 500
                                            }}
                                            value={formData.region || 'nacional'}
                                            onChange={(e) => handleChange('region', e.target.value as any)}
                                        >
                                            <option value="nacional">🇻🇪 Nacional</option>
                                            <option value="internacional">🌎 Internacional</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <FileText size={14} /> Categoría
                                        </label>
                                        <select
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '0.95rem',
                                                fontWeight: 500
                                            }}
                                            value={formData.type}
                                            onChange={(e) => handleChange('type', e.target.value as any)}
                                        >
                                            <option value={DocumentType.CONTRACT}>📄 Contrato (archivado como evidencia)</option>
                                            <option value={DocumentType.POLICY}>📋 Política Interna</option>
                                            <option value={DocumentType.REGULATORY}>⚖️ Regulatorio / Normativa</option>
                                            <option value={DocumentType.EVIDENCE}>🔍 Evidencia</option>
                                            <option value={DocumentType.LEGAL_OPINION}>💼 Opinión Legal / Dictamen</option>
                                            <option value={DocumentType.PERMIT_LICENSE}>🏛️ Permiso / Licencia / Habilitación</option>
                                            <option value={DocumentType.CIRCULAR_MEMO}>📨 Circular / Memorando</option>
                                            <option value={DocumentType.CORPORATE_GOVERNANCE}>🏢 Gobierno Corporativo (Actas, Estatutos)</option>
                                            <option value={DocumentType.TAX_FISCAL}>🧾 Fiscal / Tributario (SENIAT, RIF)</option>
                                            <option value={DocumentType.LABOR}>👷 Laboral (LOTTT, IVSS, INCES)</option>
                                            <option value={DocumentType.INSURANCE}>🛡️ Seguros / Pólizas</option>
                                            <option value={DocumentType.OTHER}>📁 Otro</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <Shield size={14} /> Estado
                                        </label>
                                        <select
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '0.95rem',
                                                fontWeight: 500
                                            }}
                                            value={formData.status}
                                            onChange={(e) => handleChange('status', e.target.value as any)}
                                        >
                                            <option value={DocumentStatus.DRAFT}>✏️ Borrador</option>
                                            <option value={DocumentStatus.IN_REVIEW}>👀 En Revisión</option>
                                            <option value={DocumentStatus.APPROVED}>✅ Aprobado</option>
                                            <option value={DocumentStatus.PUBLISHED}>📢 Publicado</option>
                                            <option value={DocumentStatus.ARCHIVED}>📦 Archivado</option>
                                            <option value={DocumentStatus.EXPIRED}>⏰ Vencido</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <AlertTriangle size={14} /> Criticidad
                                        </label>
                                        <select
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '0.95rem',
                                                fontWeight: 500
                                            }}
                                            value={formData.riskLevel}
                                            onChange={(e) => handleChange('riskLevel', e.target.value as any)}
                                        >
                                            <option value={RiskLevel.LOW}>🟢 Bajo</option>
                                            <option value={RiskLevel.MEDIUM}>🟡 Medio</option>
                                            <option value={RiskLevel.HIGH}>🟠 Alto</option>
                                            <option value={RiskLevel.CRITICAL}>🔴 Crítico</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: '#475569',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Descripción Ejecutiva <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <textarea
                                        required
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            minHeight: '110px',
                                            resize: 'vertical',
                                            padding: '1rem',
                                            fontSize: '0.95rem',
                                            borderRadius: '12px',
                                            border: '2px solid #e2e8f0',
                                            lineHeight: '1.6',
                                            fontFamily: 'inherit'
                                        }}
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        placeholder="Resumen detallado del contenido, propósito, alcance y condiciones aplicables del documento..."
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Assignment & Metadata */}
                        <div style={{
                            padding: '2rem',
                            background: '#fff',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                marginBottom: '1.5rem',
                                paddingBottom: '1rem',
                                borderBottom: '2px solid #f1f5f9'
                            }}>
                                <div style={{
                                    padding: '8px',
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    borderRadius: '12px',
                                    color: '#fff'
                                }}>
                                    <User size={20} />
                                </div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    margin: 0
                                }}>
                                    Asignación y Metadatos
                                </h3>
                            </div>

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <User size={14} /> Responsable Legal Asignado
                                        </label>
                                        <select
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontSize: '0.95rem'
                                            }}
                                            value={formData.assignedTo}
                                            onChange={(e) => handleChange('assignedTo', e.target.value)}
                                        >
                                            <option value="">👤 Sin asignar</option>
                                            {lawyers.filter(l => l.isActive).map(lawyer => (
                                                <option key={lawyer.id} value={lawyer.name}>
                                                    {lawyer.name} • {lawyer.specialty}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <Calendar size={14} /> Vencimiento
                                        </label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0'
                                            }}
                                            value={formData.metadata?.expirationDate || ''}
                                            onChange={(e) => handleMetadataChange('expirationDate', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <Building2 size={14} /> Órgano Regulador
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0'
                                            }}
                                            value={formData.metadata?.regulatoryBody || ''}
                                            onChange={(e) => handleMetadataChange('regulatoryBody', e.target.value)}
                                            placeholder="SAPI, SUNDDE, SENIAT..."
                                        />
                                    </div>

                                    <div>
                                        <label style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            marginBottom: '0.5rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#475569'
                                        }}>
                                            <MapPin size={14} /> Jurisdicción
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0'
                                            }}
                                            value={formData.metadata?.jurisdiction || ''}
                                            onChange={(e) => handleMetadataChange('jurisdiction', e.target.value)}
                                            placeholder="Venezuela, Nacional, Regional..."
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        marginBottom: '0.5rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: '#475569'
                                    }}>
                                        <Tag size={14} /> Entidad o Cliente Vinculado
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem',
                                            borderRadius: '12px',
                                            border: '2px solid #e2e8f0'
                                        }}
                                        value={formData.metadata?.linkedEntity || ''}
                                        onChange={(e) => handleMetadataChange('linkedEntity', e.target.value)}
                                        placeholder="Nombre de la empresa o contraparte"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: File Upload */}
                        <div style={{
                            padding: '2rem',
                            background: '#f8fafc',
                            borderRadius: '20px',
                            border: '2px dashed #e2e8f0',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                <div style={{
                                    padding: '1rem',
                                    background: '#fff',
                                    borderRadius: '50%',
                                    color: '#3b82f6',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                }}>
                                    <Upload size={32} />
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.5rem 0' }}>
                                        Cargar Documento Legal
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                                        Soporta PDF, DOCX, Imágnes (Máx 10MB)
                                    </p>
                                </div>

                                <input
                                    type="file"
                                    id="file-upload"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) {
                                            setSelectedFile(e.target.files[0]);
                                        }
                                    }}
                                />

                                <label htmlFor="file-upload" className="btn-secondary" style={{
                                    cursor: 'pointer',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.95rem'
                                }}>
                                    <File size={16} />
                                    {selectedFile ? selectedFile.name : 'Seleccionar Archivo'}
                                </label>

                                {formData.fileUrl && !selectedFile && (
                                    <a
                                        href="#"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            const url = formData.fileUrl!;
                                            if (url.startsWith('http')) {
                                                window.open(url, '_blank');
                                            } else {
                                                const signedUrl = await documentService.getDownloadUrl(url);
                                                if (signedUrl) {
                                                    window.open(signedUrl, '_blank');
                                                } else {
                                                    alert('No se pudo generar el enlace del archivo.');
                                                }
                                            }
                                        }}
                                        style={{
                                            fontSize: '0.85rem',
                                            color: '#2563eb',
                                            textDecoration: 'underline',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Ver archivo actual
                                    </a>
                                )}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Modern Floating Footer */}
                <div style={{
                    padding: '1.5rem 2.5rem',
                    borderTop: '1px solid #e2e8f0',
                    background: 'linear-gradient(to bottom, #fff 0%, #fafbfc 100%)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.02)'
                }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                        {initialData ? '⚡ Modificación en tiempo real' : '✨ Creación de nuevo expediente'}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={onClose}
                            className="btn-secondary"
                            style={{
                                padding: '0.75rem 1.5rem',
                                borderRadius: '12px',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="document-form"
                            className="btn-primary"
                            style={{
                                padding: '0.75rem 2rem',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                borderRadius: '12px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                            }}
                        >
                            <Save size={18} /> {uploading ? 'Procesando...' : (initialData ? 'Actualizar Documento' : 'Crear Documento')}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};
