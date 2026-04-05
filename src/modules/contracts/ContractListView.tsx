import React, { useState, useEffect } from 'react';
import {
    FileSignature, Plus, Search,
    Edit2, Trash2, ExternalLink, Clock, Calendar, AlertTriangle, Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { contractService } from './contract.service.ts';
import type { Contract, ContractStatus, ContractType } from './types.ts';
import { ContractForm } from './ContractForm.tsx';
import { ContractDetailsModal } from './ContractDetailsModal.tsx';
import { i18nService, type Currency } from '../shared/i18n.service.ts';
import { AuditTimeline } from '../shared/AuditTimeline.tsx';

export const ContractListView: React.FC = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<ContractStatus | 'ALL'>('ALL');
    const [filterType, setFilterType] = useState<ContractType | 'ALL'>('ALL');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);
    const [viewingContract, setViewingContract] = useState<Contract | undefined>(undefined);

    const [displayCurrency, setDisplayCurrency] = useState<Currency>('USD');
    const [convertedValues, setConvertedValues] = useState<Record<string, number>>({});
    const [showGuide, setShowGuide] = useState(false);
    const [auditId, setAuditId] = useState<string | null>(null);

    const loadData = async () => {
        const data = await contractService.getAll();
        setContracts(data);
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const fetchConvertedValues = async () => {
            const vals: Record<string, number> = {};
            for (const c of filteredContracts) {
                if (c.value) {
                    vals[c.id] = await i18nService.convert(c.value, (c.currency as Currency) || 'USD', displayCurrency);
                }
            }
            setConvertedValues(vals);
        };
        fetchConvertedValues();
    }, [contracts, displayCurrency, searchTerm, filterStatus, filterType]);

    const handleCreate = () => {
        setEditingContract(undefined);
        setIsFormOpen(true);
    };

    const handleEdit = (contract: Contract) => {
        setEditingContract(contract);
        setIsFormOpen(true);
    };

    const handleView = (contract: Contract) => {
        setViewingContract(contract);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de eliminar este contrato de forma permanente de la cadena forense?')) {
            await contractService.delete(id);
            await loadData();
        }
    };

    const handleSave = async () => {
        await loadData();
        setIsFormOpen(false);
    };

    const getStatusStyle = (status: ContractStatus) => {
        switch (status) {
            case 'ACTIVE':     return { bg: '#dcfce7', border: '#86efac', color: '#166534', label: 'Vigente' };
            case 'DRAFT':      return { bg: '#f1f5f9', border: '#e2e8f0', color: '#475569', label: 'Borrador' };
            case 'REVIEW':     return { bg: '#fef3c7', border: '#fcd34d', color: '#92400e', label: 'En Revisión' };
            case 'EXPIRED':    return { bg: '#fee2e2', border: '#fca5a5', color: '#b91c1c', label: 'Vencido' };
            case 'TERMINATED': return { bg: '#f8fafc', border: '#e2e8f0', color: '#64748b', label: 'Finalizado' };
            default:           return { bg: '#f1f5f9', border: '#e2e8f0', color: '#64748b', label: status };
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            SERVICE:     '🔧 Servicios',
            EMPLOYMENT:  '👔 Laboral',
            NDA:         '🔒 NDA',
            LEASE:       '🏠 Arrendamiento',
            PARTNERSHIP: '🤝 Alianza',
            SUPPLY:      '📦 Suministro',
            CONSULTING:  '🎯 Consultoría',
            FRANCHISE:   '🏪 Franquicia',
            LOAN:        '💰 Préstamo',
            OTHER:       '📋 Otro',
        };
        return labels[type] || type;
    };

    const filteredContracts = contracts.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.parties.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
        const matchesType = filterType === 'ALL' || c.type === filterType;
        return matchesSearch && matchesStatus && matchesType;
    });

    return (
        <div className="space-y-6" style={{ fontFamily: 'var(--font-body)' }}>
            {/* Header: Premium Centered/Lordly Style */}
            <div style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                padding: '3.5rem 2.5rem',
                borderRadius: '28px',
                color: '#fff',
                marginBottom: '2.5rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(59, 130, 246, 0.2)'
            }}>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
                                <FileSignature size={24} />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.9 }}>
                                Dirección de Asuntos Legales
                            </span>
                        </div>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
                            Gestión Contractual
                        </h2>
                        <p style={{ fontSize: '1.1rem', opacity: 0.8, marginTop: '0.5rem', maxWidth: '600px' }}>
                            Supervisión y trazabilidad completa del ciclo de vida de instrumentos legales y acuerdos corporativos.
                        </p>
                    </div>
                    <button
                        onClick={handleCreate}
                        style={{
                            background: '#fff', color: '#1e3a8a', padding: '1rem 2rem', borderRadius: '14px',
                            border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                    >
                        <Plus size={20} /> Crear Nuevo Contrato
                    </button>
                </div>
                {/* Decorative Elements */}
                <div style={{ position: 'absolute', bottom: '-20%', right: '-5%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)', borderRadius: '50%' }} />
            </div>

            {/* Guía de uso del módulo */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '14px', overflow: 'hidden' }}>
                <button
                    onClick={() => setShowGuide(!showGuide)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0.875rem 1.25rem', border: 'none', background: 'transparent', cursor: 'pointer',
                        color: '#1d4ed8', fontWeight: 700, fontSize: '0.85rem'
                    }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Info size={16} /> ¿Qué se gestiona aquí? — Guía rápida
                    </span>
                    {showGuide ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showGuide && (
                    <div style={{ padding: '0 1.25rem 1.25rem', fontSize: '0.82rem', color: '#1e3a8a', lineHeight: 1.6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid #dbeafe' }}>
                                <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#1d4ed8', fontSize: '0.78rem' }}>✅ SÍ VA AQUÍ</p>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <li>Contratos de servicios con proveedores</li>
                                    <li>Contratos laborales (empleados)</li>
                                    <li>Acuerdos de confidencialidad (NDA)</li>
                                    <li>Arrendamientos y alianzas</li>
                                    <li>Todo acuerdo con <strong>dos partes, monto y fechas</strong></li>
                                </ul>
                            </div>
                            <div style={{ background: '#fff', padding: '1rem', borderRadius: '10px', border: '1px solid #dbeafe' }}>
                                <p style={{ margin: '0 0 8px', fontWeight: 800, color: '#dc2626', fontSize: '0.78rem' }}>❌ NO VA AQUÍ</p>
                                <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <li>Políticas internas → <strong>Gestión Documental</strong></li>
                                    <li>Normativas y regulaciones → <strong>Gestión Documental</strong></li>
                                    <li>Permisos, licencias, circulares → <strong>Gestión Documental</strong></li>
                                </ul>
                                <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                    💡 <strong>Regla:</strong> ¿Hay dos partes con obligaciones mutuas? → Contratos. ¿Es una referencia legal o evidencia? → Gestión Documental.
                                </p>
                            </div>
                        </div>
                        <div style={{ background: '#fff', padding: '0.875rem 1rem', borderRadius: '10px', border: '1px solid #dbeafe' }}>
                            <p style={{ margin: 0, fontWeight: 700, color: '#1d4ed8', fontSize: '0.78rem' }}>🔗 Flujo recomendado</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#475569' }}>
                                Si recibes un documento externo que será contrato: primero regístralo en <strong>Gestión Documental</strong> (análisis IA), luego vincula aquí usando el selector "Vincular Documento del Repositorio" al crear el contrato.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Box */}
            <div className="premium-card" style={{
                background: '#fff', padding: '1.5rem', display: 'flex', gap: '1.25rem', alignItems: 'center',
                flexWrap: 'wrap', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                border: '1px solid #f1f5f9'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text" placeholder="Buscar por título, empresa o contraparte..."
                        style={{
                            width: '100%', padding: '0.875rem 1rem 0.875rem 3.5rem', borderRadius: '14px',
                            border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none'
                        }}
                        value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select
                        style={{ padding: '0.875rem 1rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', outline: 'none', fontSize: '0.9rem', fontWeight: 600 }}
                        value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
                    >
                        <option value="ALL">Todos los Estados</option>
                        <option value="ACTIVE">✅ Vigentes</option>
                        <option value="DRAFT">✏️ Borradores</option>
                        <option value="REVIEW">👀 En Revisión</option>
                        <option value="EXPIRED">⏰ Vencidos</option>
                        <option value="TERMINATED">📦 Finalizados</option>
                    </select>

                    <select
                        style={{ padding: '0.875rem 1rem', borderRadius: '14px', border: '1.5px solid #e2e8f0', background: '#fff', outline: 'none', fontSize: '0.9rem', fontWeight: 600 }}
                        value={filterType} onChange={(e) => setFilterType(e.target.value as any)}
                    >
                        <option value="ALL">Todos los Tipos</option>
                        <option value="SERVICE">🔧 Servicios</option>
                        <option value="EMPLOYMENT">👔 Laboral</option>
                        <option value="NDA">🔒 NDA</option>
                        <option value="LEASE">🏠 Arrendamiento</option>
                        <option value="PARTNERSHIP">🤝 Alianza</option>
                        <option value="SUPPLY">📦 Suministro</option>
                        <option value="CONSULTING">🎯 Consultoría</option>
                        <option value="FRANCHISE">🏪 Franquicia</option>
                        <option value="LOAN">💰 Préstamo</option>
                        <option value="OTHER">📋 Otro</option>
                    </select>

                    <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 1.25rem', background: '#f8fafc', borderRadius: '14px', border: '1.5px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em' }}>MONEDA:</span>
                        <select
                            style={{ border: 'none', background: 'transparent', fontWeight: 800, color: '#1e3a8a', outline: 'none', cursor: 'pointer', fontSize: '0.9rem' }}
                            value={displayCurrency}
                            onChange={(e) => setDisplayCurrency(e.target.value as Currency)}
                        >
                            <option value="USD">USD ($)</option>
                            <option value="VES">VES (Bs)</option>
                            <option value="EUR">EUR (€)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Content: Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '2rem' }}>
                {filteredContracts.map(contract => {
                    const statusStyle = getStatusStyle(contract.status);
                    const lawyerDisplay = contract.assignedLawyerName
                        || (contract.assignedLawyerId.includes('-')
                            ? 'Asesor del Sistema'
                            : contract.assignedLawyerId);
                    const initials = lawyerDisplay
                        .split(' ')
                        .map((w: string) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || 'AS';

                    return (
                        <div key={contract.id} style={{
                            background: '#fff', borderRadius: '24px', padding: '2rem',
                            border: '1px solid #f1f5f9', position: 'relative',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 10px 15px -3px rgba(0,0,0,0.03)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            display: 'flex', flexDirection: 'column'
                        }}
                            className="contract-card"
                        >
                            {/* Urgent Ribbon */}
                            {contract.metadata.urgent && (
                                <div style={{
                                    position: 'absolute', top: '1rem', left: '-5px',
                                    background: '#ef4444', color: '#fff', padding: '4px 12px',
                                    borderRadius: '4px 8px 8px 4px', fontSize: '0.65rem', fontWeight: 900,
                                    boxShadow: '4px 4px 10px rgba(239, 68, 68, 0.3)',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}>
                                    <AlertTriangle size={12} /> URGENTE
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{
                                        padding: '6px 14px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 800,
                                        background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`,
                                        textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        {statusStyle.label}
                                    </span>
                                    <span style={{
                                        padding: '6px 14px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 800,
                                        background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0',
                                        textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        {getTypeLabel(contract.type)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => handleEdit(contract)} style={{ border: 'none', background: '#f8fafc', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#64748b' }}><Edit2 size={16} /></button>
                                    <button onClick={() => handleDelete(contract.id)} style={{ border: 'none', background: '#fff1f2', padding: '8px', borderRadius: '10px', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={16} /></button>
                                </div>
                            </div>

                            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.75rem', lineHeight: '1.3' }}>
                                {contract.title}
                            </h3>

                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem',
                                margin: '1rem 0 2rem 0', padding: '1.5rem', background: '#f8fafc',
                                borderRadius: '20px', border: '1px solid #f1f5f9'
                            }}>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>PARTES</span>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', lineHeight: '1.4' }}>
                                        {contract.parties[0]} <br />
                                        <div style={{ width: '20px', height: '1px', background: '#cbd5e1', margin: '4px 0' }} />
                                        {contract.parties[1]}
                                    </div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>VALOR ESTIMADO</span>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e3a8a' }}>
                                        {i18nService.formatCurrency(convertedValues[contract.id] || contract.value || 0, displayCurrency)}
                                    </div>
                                    <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>
                                        Base: {contract.currency} {contract.value}
                                    </span>
                                </div>
                            </div>

                            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '40px', height: '40px', borderRadius: '12px',
                                        background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.9rem', fontWeight: 800, boxShadow: '0 4px 10px rgba(30, 58, 138, 0.2)'
                                    }}>
                                        {initials}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>{lawyerDisplay}</span>
                                        <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>Asesor Jurídico</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', color: '#94a3b8', marginBottom: '4px' }}>
                                        <Calendar size={12} />
                                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>VENCIMIENTO</span>
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                                        {contract.endDate || 'Indeterminado'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
                                <button 
                                    className="btn-secondary" 
                                    onClick={() => setAuditId(contract.id)}
                                    style={{
                                        flex: 1, padding: '0.875rem', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700,
                                        border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                        gap: '0.5rem', cursor: 'pointer', background: '#fff'
                                    }}
                                >
                                    <Clock size={16} color="#475569" /> Historial
                                </button>
                                <button
                                    onClick={() => handleView(contract)}
                                    style={{
                                        flex: 1, padding: '0.875rem', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 700,
                                        background: '#1e3a8a', color: '#fff', border: 'none', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                        boxShadow: '0 4px 12px rgba(30, 58, 138, 0.2)'
                                    }}
                                >
                                    <ExternalLink size={16} /> Ver Documento
                                </button>
                            </div>
                        </div>
                    );
                })}

                {filteredContracts.length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '8rem 2rem', background: '#fff', borderRadius: '32px', border: '2px dashed #e2e8f0' }}>
                        <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <FileSignature size={40} color="#cbd5e1" strokeWidth={1.5} />
                        </div>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#334155', margin: '0 0 0.5rem 0' }}>Búsqueda sin resultados</h4>
                        <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto' }}>Ajuste los criterios de búsqueda o filtros para localizar el instrumento legal.</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {isFormOpen && (
                <ContractForm
                    initialData={editingContract}
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                />
            )}

            {viewingContract && (
                <ContractDetailsModal
                    contract={viewingContract}
                    onClose={() => setViewingContract(undefined)}
                    onUpdated={loadData}
                />
            )}

            {auditId && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '500px', background: '#fff', height: '100%', boxShadow: '-4px 0 25px rgba(0,0,0,0.1)', animation: 'slideIn 0.3s ease-out' }}>
                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <AuditTimeline 
                                entityType="contract" 
                                entityId={auditId} 
                                showClose 
                                onClose={() => setAuditId(null)} 
                            />
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .contract-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.04) !important;
                    border-color: #3b82f6 !important;
                }
            `}</style>
        </div>
    );
};
