import React from 'react';
import { X, FileText, FileSignature, Briefcase, Mail, Hash } from 'lucide-react';
import type { Lawyer } from './types.ts';
import { documentService } from '../documents/documents.service.ts';
import { contractService } from '../contracts/contract.service.ts';

interface LawyerDossierModalProps {
    lawyer: Lawyer;
    onClose: () => void;
}

export const LawyerDossierModal: React.FC<LawyerDossierModalProps> = ({ lawyer, onClose }) => {
    const [documents, setDocuments] = React.useState<any[]>([]);
    const [contracts, setContracts] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const loadDossierData = async () => {
            try {
                const [allDocs, allContracts] = await Promise.all([
                    documentService.getAll(),
                    contractService.getAll()
                ]);
                setDocuments(allDocs.filter(d => d.assignedTo === lawyer.name));
                setContracts(allContracts.filter(c => c.assignedLawyerId === lawyer.id));
            } catch (err) {
                console.error('Error loading dossier data:', err);
            } finally {
                setLoading(false);
            }
        };
        loadDossierData();
    }, [lawyer]);

    if (loading) return null; // O un spinner pequeño

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 110,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)'
        }}>
            <div className="premium-card" style={{
                width: '100%', maxWidth: '900px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                padding: 0, borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                background: '#f8fafc'
            }}>
                {/* Header Profile Section */}
                <div style={{
                    padding: '2rem', background: 'linear-gradient(135deg, var(--legal-950) 0%, #1e40af 100%)',
                    color: '#fff', position: 'relative'
                }}>
                    <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', color: '#fff', padding: '8px', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>

                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                        <div style={{
                            width: '100px', height: '100px', borderRadius: '24px', background: 'rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 800,
                            border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                            {lawyer.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                                <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{lawyer.name}</h2>
                                <span style={{
                                    padding: '4px 12px', borderRadius: '20px', background: 'rgba(255,255,255,0.15)',
                                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase'
                                }}>
                                    {lawyer.type === 'INTERNAL' ? '💎 Interno' : '🌍 Externo'}
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '2rem', opacity: 0.9 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                    <Briefcase size={16} /> {lawyer.specialty}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                    <Hash size={16} /> {lawyer.inpreabogado}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                    <Mail size={16} /> {lawyer.email}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Tabs area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                    {/* Documents List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                            <FileText size={20} color="var(--legal-700)" /> Expediente Documental ({documents.length})
                        </h3>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {documents.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px dashed #e2e8f0', color: '#64748b' }}>
                                    Sin documentos asignados.
                                </div>
                            ) : documents.map(doc => (
                                <div key={doc.id} style={{ padding: '1rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{doc.title}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{doc.type} | {doc.id}</div>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>ACTIVO</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Contracts List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                            <FileSignature size={20} color="#7c3aed" /> Registro de Contratos ({contracts.length})
                        </h3>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {contracts.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px dashed #e2e8f0', color: '#64748b' }}>
                                    Sin contratos a cargo.
                                </div>
                            ) : contracts.map(ctr => (
                                <div key={ctr.id} style={{ padding: '1rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{ctr.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{ctr.type}</span>
                                        <span style={{ fontWeight: 700, color: '#7c3aed' }}>{ctr.currency} {ctr.value?.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer stats */}
                <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #e2e8f0', background: '#fff', display: 'flex', justifyContent: 'space-around' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>{documents.length + contracts.length}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Cargas Totales</div>
                    </div>
                    <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{lawyer.isActive ? '100%' : '0%'}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Disponibilidad</div>
                    </div>
                    <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--legal-800)' }}>4.8</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Rating Interno</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
