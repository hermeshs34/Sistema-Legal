import React, { useState, useEffect } from 'react';
import {
    Users, Plus, Search, Mail, Phone, Hash, ExternalLink, Edit2, Trash2,
    UserCheck, UserX, Briefcase
} from 'lucide-react';
import type { Lawyer } from './types.ts';
import { lawyerService } from './lawyers.service.ts';
import { LawyerForm } from './LawyerForm.tsx';
import { LawyerDossierModal } from './LawyerDossierModal.tsx';

export const LawyerListView: React.FC = () => {
    const [lawyers, setLawyers] = useState<Lawyer[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | 'INTERNAL' | 'EXTERNAL'>('ALL');

    // Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingLawyer, setEditingLawyer] = useState<Lawyer | undefined>(undefined);
    const [viewingDossier, setViewingDossier] = useState<Lawyer | undefined>(undefined);

    const loadData = async () => {
        const data = await lawyerService.getAll();
        setLawyers(data);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleCreate = () => {
        setEditingLawyer(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (lawyer: Lawyer) => {
        setEditingLawyer(lawyer);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de eliminar a este miembro del directorio?')) {
            await lawyerService.delete(id);
            await loadData();
        }
    };

    const handleSave = async () => {
        await loadData();
        setIsFormOpen(false);
    };

    const filteredLawyers = lawyers.filter(l => {
        const matchesSearch =
            l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            l.inpreabogado.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = filterType === 'ALL' || l.type === filterType;

        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6" style={{ fontFamily: 'var(--font-body)' }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '1.5rem',
                borderBottom: '1px solid #e2e8f0',
                marginBottom: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        padding: '12px',
                        background: 'linear-gradient(135deg, var(--legal-900) 0%, #1e40af 100%)',
                        borderRadius: '16px',
                        color: '#fff',
                        boxShadow: '0 8px 16px rgba(30, 58, 138, 0.15)'
                    }}>
                        <Users size={32} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.025em', margin: 0 }}>
                            Directorio Legal Pro
                        </h2>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '4px 0 0 0' }}>
                            Gestión centralizada de capital humano jurídico y consultores.
                        </p>
                    </div>
                </div>
                <button
                    className="btn-primary"
                    onClick={handleCreate}
                    style={{
                        padding: '0.8rem 1.5rem',
                        borderRadius: '12px',
                        background: 'var(--legal-900)',
                        boxShadow: '0 4px 12px rgba(30, 58, 138, 0.2)',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <Plus size={20} />
                    Agregar Profesional
                </button>
            </div>

            {/* Enhanced Control Bar */}
            <div className="premium-card" style={{
                padding: '1.25rem',
                background: '#fff',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
                flexWrap: 'wrap'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, especialidad, INPRE o contacto..."
                        className="form-input"
                        style={{
                            width: '100%',
                            padding: '0.875rem 1rem 0.875rem 3.5rem',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc'
                        }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{
                        display: 'flex',
                        background: '#f1f5f9',
                        padding: '4px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0'
                    }}>
                        {[
                            { id: 'ALL', label: 'Todos' },
                            { id: 'INTERNAL', label: 'Internos' },
                            { id: 'EXTERNAL', label: 'Externos' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id as any)}
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: filterType === type.id ? '#fff' : 'transparent',
                                    color: filterType === type.id ? 'var(--legal-900)' : '#64748b',
                                    boxShadow: filterType === type.id ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Lawyer Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '1.75rem',
                marginTop: '1rem'
            }}>
                {filteredLawyers.length === 0 ? (
                    <div style={{
                        gridColumn: '1 / -1',
                        padding: '5rem',
                        textAlign: 'center',
                        background: '#fff',
                        borderRadius: '20px',
                        border: '2px dashed #e2e8f0',
                        color: '#94a3b8'
                    }}>
                        <Users size={64} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No se encontraron miembros en el directorio legal.</p>
                        <p style={{ fontSize: '0.9rem' }}>Intente con otros términos de búsqueda o filtros.</p>
                    </div>
                ) : filteredLawyers.map(lawyer => (
                    <div key={lawyer.id} className="premium-card" style={{
                        background: '#fff',
                        padding: '1.75rem',
                        border: '1px solid #e2e8f0',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-6px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        {/* Status Stripe */}
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                            background: lawyer.type === 'INTERNAL' ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)'
                        }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                background: lawyer.type === 'INTERNAL' ? '#f0fdf4' : '#eff6ff',
                                color: lawyer.type === 'INTERNAL' ? '#166534' : '#1e40af',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                border: '1px solid ' + (lawyer.type === 'INTERNAL' ? '#bcf0da' : '#bfdbfe')
                            }}>
                                {lawyer.type === 'INTERNAL' ? '💎 Equipo Interno' : '🌍 Externo / Aliado'}
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => handleEdit(lawyer)}
                                    style={{ padding: '8px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#3b82f6'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
                                    title="Editar perfil"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(lawyer.id)}
                                    style={{ padding: '8px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#ef4444', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                                    title="Eliminar de directorio"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '18px',
                                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--legal-800)', border: '1px solid #e2e8f0', fontSize: '1.5rem', fontWeight: 700
                            }}>
                                {lawyer.name.charAt(0)}
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px', letterSpacing: '-0.01em' }}>{lawyer.name}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--legal-700)', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <Briefcase size={14} />
                                    {lawyer.specialty}
                                </div>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
                            background: '#f8fafc', padding: '1.25rem', borderRadius: '14px',
                            border: '1px solid #f1f5f9', marginBottom: '1.5rem'
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>INPRE / RIF</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>{lawyer.inpreabogado}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Estatus</span>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', color: lawyer.isActive ? '#10b981' : '#ef4444', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {lawyer.isActive ? <UserCheck size={14} /> : <UserX size={14} />}
                                    {lawyer.isActive ? 'OPERATIVO' : 'INACTIVO'}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#475569', fontSize: '0.9rem' }}>
                                <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}><Mail size={14} /></div>
                                {lawyer.email}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#475569', fontSize: '0.9rem' }}>
                                <div style={{ padding: '6px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}><Phone size={14} /></div>
                                {lawyer.phone}
                            </div>
                        </div>

                        <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setViewingDossier(lawyer)}
                                style={{
                                    flex: 1, padding: '0.6rem', borderRadius: '10px', border: '1px solid #e2e8f0',
                                    background: '#fff', color: '#475569', fontSize: '0.85rem', fontWeight: 600,
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = '#fff'; }}
                            >
                                <Hash size={14} /> Ver Expediente
                            </button>
                            <button style={{
                                padding: '0.6rem 1rem', borderRadius: '10px', border: 'none',
                                background: 'var(--legal-50)', color: 'var(--legal-900)', fontSize: '0.85rem', fontWeight: 600,
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--legal-100)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--legal-50)'; }}
                            >
                                <ExternalLink size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Form */}
            {isFormOpen && (
                <LawyerForm
                    initialData={editingLawyer}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                />
            )}

            {/* Dossier Modal */}
            {viewingDossier && (
                <LawyerDossierModal
                    lawyer={viewingDossier}
                    onClose={() => setViewingDossier(undefined)}
                />
            )}
        </div>
    );
};
