import { useState, useEffect, useCallback } from 'react';
import { X, FileSignature, Info, Upload, FileText, Type, Loader2, Link2, AlertCircle } from 'lucide-react';
import type { Contract } from './types.ts';
import { contractService } from './contract.service.ts';
import { lawyerService } from '../legal-team/lawyers.service.ts';
import { documentService } from '../documents/documents.service.ts';
import type { Document } from '../documents/types.ts';
import { supabase } from '../../core/supabase.ts';
import { aiService } from '../documents/ai.service.ts';
import { ContractEditor } from './ContractEditor.tsx';
import { auditService } from '../shared/audit.service.ts';
import type { AuditLog } from '../shared/audit.service.ts';

interface ContractFormProps {
    initialData?: Contract;
    onClose: () => void;
    onSave: () => void;
}

export const ContractForm: React.FC<ContractFormProps> = ({ initialData, onClose, onSave }) => {
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'DRAFT'>('GENERAL');
    const [isUploading, setIsUploading] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [availableDocs, setAvailableDocs] = useState<Document[]>([]);
    const [linkedDoc, setLinkedDoc] = useState<Document | null>(null);
    const [lawyers, setLawyers] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [formData, setFormData] = useState<Partial<Contract>>({
        title: '',
        type: 'SERVICE',
        status: 'DRAFT',
        parties: ['', ''],
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        value: 0,
        currency: 'USD',
        assignedLawyerId: '',
        description: '',
        content_draft: '',
        file_url: '',
        metadata: {
            urgent: false,
            autoRenewal: false,
            confidential: true
        }
    });

    const loadAuditLogs = useCallback(async (id: string) => {
        const logs = await auditService.getByEntity('contract', id);
        setAuditLogs(logs.filter(l => l.action === 'comment'));
    }, []);

    useEffect(() => {
        const loadLawyers = async () => {
            const data = await lawyerService.getAll();
            setLawyers(data);
            if (!initialData && data.length > 0) {
                setFormData(prev => ({ ...prev, assignedLawyerId: data[0].id }));
            }
        };
        const loadDocs = async () => {
            const docs = await documentService.getAll();
            setAvailableDocs(docs);
            if (initialData?.document_id) {
                const found = docs.find(d => d.id === initialData.document_id);
                if (found) setLinkedDoc(found);
            }
        };
        loadLawyers();
        loadDocs();
        if (initialData?.id) {
            loadAuditLogs(initialData.id);
        }
    }, [initialData, loadAuditLogs]);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (field: keyof Contract, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handlePartyChange = (index: number, value: string) => {
        const newParties = [...(formData.parties || ['', ''])];
        newParties[index] = value;
        setFormData(prev => ({ ...prev, parties: newParties }));
    };

    const handleMetadataChange = (field: keyof Contract['metadata'], value: boolean) => {
        setFormData(prev => ({
            ...prev,
            metadata: { ...prev.metadata!, [field]: value }
        }));
    };

    const handleSaveComment = async (text: string) => {
        if (!initialData?.id || !text.trim()) return;
        const { data: { user } } = await supabase.auth.getUser();
        
        await auditService.log({
            entityType: 'contract',
            entityId: initialData.id,
            action: 'comment',
            details: { text, author: user?.email?.split('@')[0] || 'Abogado' }
        });
        loadAuditLogs(initialData.id);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const safeFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const { data: uploadData, error } = await supabase.storage
                .from('contracts')
                .upload(safeFileName, file, { upsert: true });

            if (error) throw error;

            // Guardamos el PATH interno, no la URL pública.
            // Para visualizar, usar createSignedUrl bajo demanda.
            setFormData(prev => ({ ...prev, file_url: uploadData.path }));
        } catch (error) {
            console.error('Upload error:', error);
            alert('Error al cargar el archivo');
        } finally {
            setIsUploading(false);
        }
    };

    const handleExtractContent = async () => {
        if (!formData.file_url) return;

        setIsExtracting(true);
        try {
            const contentType = formData.type === 'OTHER' ? 'regulatory' : 'contract';
            const content = await aiService.extractFullContent('temp_id', contentType, formData.title ?? '');
            setFormData(prev => ({ ...prev, content_draft: content }));
        } catch (error) {
            console.error(error);
            alert('Error al extraer contenido del documento');
        } finally {
            setIsExtracting(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.title || !formData.assignedLawyerId) return;

        const contractToSave = {
            ...formData,
            id: initialData?.id || contractService.generateId(),
        } as Contract;

        await contractService.save(contractToSave);
        onSave();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 110,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease-out', padding: '1rem'
        }}>
            <div style={{
                width: '100%', maxWidth: '1200px', height: '95vh',
                display: 'flex', flexDirection: 'column',
                borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.4)',
                background: '#fff',
                animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div style={{
                    padding: '1.25rem 2.5rem',
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    color: '#fff',
                    position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '14px' }}>
                            <FileSignature size={24} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                                {initialData ? 'Editor Forense' : 'Nuevo Instrumento Legal'}
                            </h2>
                            <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: '2px 0 0 0' }}>
                                {formData.title || 'Iniciando redacción...'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{
                        border: 'none', background: 'rgba(255,255,255,0.05)',
                        borderRadius: '50%', color: '#fff', padding: '10px',
                        cursor: 'pointer', display: 'flex', transition: 'all 0.2s'
                    }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '0 1.5rem' }}>
                    <button onClick={() => setActiveTab('GENERAL')} style={{
                        padding: '1.25rem 1.5rem', border: 'none', background: 'transparent',
                        color: activeTab === 'GENERAL' ? '#6366f1' : '#64748b',
                        fontWeight: 700, borderBottom: activeTab === 'GENERAL' ? '3px solid #6366f1' : '3px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <Info size={17} /> Datos Estructurales
                    </button>
                    <button onClick={() => setActiveTab('DRAFT')} style={{
                        padding: '1.25rem 1.5rem', border: 'none', background: 'transparent',
                        color: activeTab === 'DRAFT' ? '#6366f1' : '#64748b',
                        fontWeight: 700, borderBottom: activeTab === 'DRAFT' ? '3px solid #6366f1' : '3px solid transparent',
                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        <Type size={17} /> Centro de Redacción
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', background: '#fafbfc', display: 'flex', flexDirection: 'column' }}>
                    {activeTab === 'GENERAL' ? (
                        <form id="contract-form" onSubmit={handleSubmit} style={{ padding: '2.5rem', display: 'grid', gap: '2rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'grid', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Denominación del Instrumento</label>
                                        <input type="text" required style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9', fontSize: '1rem', outlineColor: '#6366f1' }} value={formData.title} onChange={e => handleChange('title', e.target.value)} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Categoría Legal</label>
                                            <select style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#fff' }} value={formData.type} onChange={e => handleChange('type', e.target.value)}>
                                                <option value="SERVICE">🔧 Servicios</option>
                                                <option value="EMPLOYMENT">👔 Laboral</option>
                                                <option value="NDA">🔒 Confidencialidad</option>
                                                <option value="LEASE">🏠 Arrendamiento</option>
                                                <option value="OTHER">📋 Otros</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Estado del Flujo</label>
                                            <select style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#fff' }} value={formData.status} onChange={e => handleChange('status', e.target.value)}>
                                                <option value="DRAFT">✏️ Borrador</option>
                                                <option value="REVIEW">👀 En Revisión</option>
                                                <option value="ACTIVE">✅ Vigente</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
                                    {isUploading ? (
                                        <Loader2 className="animate-spin" color="#7c3aed" />
                                    ) : formData.file_url ? (
                                        <div style={{ color: '#059669' }}>
                                            <FileText size={40} />
                                            <p style={{ margin: '8px 0', fontWeight: 700, fontSize: '0.8rem' }}>Documento PDF OK</p>
                                            <button type="button" onClick={() => handleChange('file_url', '')} style={{ fontSize: '0.7rem', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Eliminar archivo</button>
                                        </div>
                                    ) : (
                                        <>
                                            <input type="file" onChange={handleFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                                            <Upload size={32} color="#94a3b8" />
                                            <p style={{ margin: '8px 0', color: '#64748b', fontSize: '0.82rem', fontWeight: 600 }}>Cargar Escaneo / Firmado</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Primera Parte (Contratante)</label>
                                    <input type="text" placeholder="Persona o Entidad A" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9' }} value={formData.parties?.[0]} onChange={e => handlePartyChange(0, e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Segunda Parte (Contratado)</label>
                                    <input type="text" placeholder="Persona o Entidad B" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9' }} value={formData.parties?.[1]} onChange={e => handlePartyChange(1, e.target.value)} />
                                </div>
                            </div>

                            <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Monto Contractual</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input type="number" style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9' }} value={formData.value} onChange={e => handleChange('value', Number(e.target.value))} />
                                        <select style={{ width: '80px', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9' }} value={formData.currency} onChange={e => handleChange('currency', e.target.value)}>
                                            <option value="USD">USD</option>
                                            <option value="VES">VES</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Fecha Inicio</label>
                                    <input type="date" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9' }} value={formData.startDate} onChange={e => handleChange('startDate', e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Vencimiento</label>
                                    <input type="date" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9' }} value={formData.endDate} onChange={e => handleChange('endDate', e.target.value)} />
                                </div>
                            </div>
                            
                            <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Abogado Responsable</label>
                                    <select style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9', background: '#fff' }} value={formData.assignedLawyerId} onChange={e => handleChange('assignedLawyerId', e.target.value)}>
                                        {lawyers.map(l => (
                                            <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', paddingTop: '1.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                        <input type="checkbox" checked={formData.metadata?.urgent} onChange={e => handleMetadataChange('urgent', e.target.checked)} />
                                        Prioridad Urgente
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                                        <input type="checkbox" checked={formData.metadata?.confidential} onChange={e => handleMetadataChange('confidential', e.target.checked)} />
                                        Confidencial
                                    </label>
                                </div>
                            </div>

                            <div style={{ background: '#fff', padding: '2rem', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '1rem' }}>
                                    <Link2 size={16} color="#6366f1" /> Vincular del Repositorio (Opcional)
                                </label>
                                {linkedDoc ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={18} /> {linkedDoc.title}</div>
                                        <button type="button" onClick={() => {setLinkedDoc(null); handleChange('document_id', null);}} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer'}}>Desvincular</button>
                                    </div>
                                ) : (
                                    <select style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #f1f5f9' }} value="" onChange={e => {
                                        const doc = availableDocs.find(d => d.id === e.target.value);
                                        if (doc) { setLinkedDoc(doc); handleChange('document_id', doc.id); }
                                    }}>
                                        <option value="">— Buscar en Gestión Documental —</option>
                                        {availableDocs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                                    </select>
                                )}
                            </div>
                        </form>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <ContractEditor
                                initialContent={formData.content_draft || ''}
                                onChange={(html) => handleChange('content_draft', html)}
                                onSave={() => handleSubmit()}
                                comments={auditLogs}
                                onAddComment={handleSaveComment}
                            />
                            
                            {isExtracting && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                                    <div style={{ background: '#fff', padding: '2rem', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
                                        <Loader2 className="animate-spin" size={48} color="#7c3aed" />
                                        <p style={{ marginTop: '1rem', fontWeight: 700, color: '#1e293b' }}>EXTRAYENDO CONTENIDO CON IA...</p>
                                    </div>
                                </div>
                            )}

                            {(!formData.content_draft || formData.content_draft.length < 50) && formData.file_url && !isExtracting && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                                   <div style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
                                        <Type size={48} color="#7c3aed" style={{ marginBottom: '1.5rem' }} />
                                        <h3 style={{ margin: '0 0 1rem 0' }}>Borrador Vacío</h3>
                                        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>Deseas que la IA proponga un borrador basado en el documento PDF cargado?</p>
                                        <button onClick={handleExtractContent} style={{ width: '100%', padding: '1rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>GENERAR PROPUESTA IA</button>
                                   </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ padding: '1.25rem 2.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                        <AlertCircle size={14} /> ENTORNO DE ALTA SEGURIDAD VENEZUELA
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>CANCELAR</button>
                        <button type="submit" form="contract-form" onClick={() => handleSubmit()} style={{ padding: '0.75rem 2.5rem', border: 'none', background: '#6366f1', color: '#fff', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 16px -4px rgba(99, 102, 241, 0.4)', transition: 'all 0.2s' }}>
                            GUARDAR Y FINALIZAR
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
};
