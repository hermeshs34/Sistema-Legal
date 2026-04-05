import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Phone, Hash, Briefcase, UserCheck, Users, Building2 } from 'lucide-react';
import type { Lawyer, LawyerType } from './types.ts';
import { lawyerService } from './lawyers.service.ts';

interface LawyerFormProps {
    initialData?: Lawyer;
    onClose: () => void;
    onSave: () => void;
}

export const LawyerForm: React.FC<LawyerFormProps> = ({ initialData, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Lawyer>>({
        name: '',
        email: '',
        phone: '',
        inpreabogado: '',
        type: 'INTERNAL',
        specialty: '',
        isActive: true
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (field: keyof Lawyer, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email) return;

        const lawyerToSave = {
            ...formData,
            id: initialData?.id || lawyerService.generateId(),
        } as Lawyer;

        await lawyerService.save(lawyerToSave);
        onSave();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 110,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div className="premium-card" style={{
                width: '100%', maxWidth: '750px', maxHeight: '92vh',
                display: 'flex', flexDirection: 'column',
                padding: 0, borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
                background: '#fff',
                animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                {/* Premium Gradient Header */}
                <div style={{
                    padding: '2rem 2.5rem',
                    background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 50%, #6366f1 100%)',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        position: 'absolute',
                        top: '-50%',
                        right: '-10%',
                        width: '300px',
                        height: '300px',
                        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)',
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
                            <Users size={32} strokeWidth={2} />
                        </div>
                        <div>
                            <h2 style={{
                                fontSize: '1.75rem',
                                fontWeight: 800,
                                margin: 0,
                                letterSpacing: '-0.025em',
                                textShadow: '0 2px 10px rgba(0,0,0,0.1)'
                            }}>
                                {initialData ? 'Actualizar Perfil' : 'Nuevo Miembro Legal'}
                            </h2>
                            <p style={{
                                fontSize: '0.95rem',
                                margin: '6px 0 0 0',
                                opacity: 0.9,
                                fontWeight: 500
                            }}>
                                {initialData ? `Modificando: ${initialData.name}` : 'Registro de profesional en el directorio'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '2.5rem',
                    background: 'linear-gradient(to bottom, #fafbfc 0%, #fff 100%)'
                }}>
                    <form id="lawyer-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '2rem' }}>

                        {/* Section 1: Personal Information */}
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
                                    background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
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
                                    Información Personal
                                </h3>
                            </div>

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '0.875rem',
                                        fontWeight: 600,
                                        color: '#475569',
                                        marginBottom: '0.5rem'
                                    }}>
                                        Nombre Completo <span style={{ color: '#ef4444' }}>*</span>
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
                                        value={formData.name}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        placeholder="Ej. María Alejandra González"
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#0ea5e9'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
                                            <Mail size={14} /> Correo Electrónico
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0'
                                            }}
                                            value={formData.email}
                                            onChange={(e) => handleChange('email', e.target.value)}
                                            placeholder="email@firma.ve"
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
                                            <Phone size={14} /> Teléfono de Contacto
                                        </label>
                                        <input
                                            type="tel"
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0'
                                            }}
                                            value={formData.phone}
                                            onChange={(e) => handleChange('phone', e.target.value)}
                                            placeholder="+58 412-1234567"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Professional Details */}
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
                                    <Briefcase size={20} />
                                </div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    margin: 0
                                }}>
                                    Información Profesional
                                </h3>
                            </div>

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
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
                                            <Hash size={14} /> INPRE / RIF
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="form-input"
                                            style={{
                                                width: '100%',
                                                padding: '0.875rem 1rem',
                                                borderRadius: '12px',
                                                border: '2px solid #e2e8f0',
                                                fontFamily: 'monospace',
                                                fontWeight: 600
                                            }}
                                            value={formData.inpreabogado}
                                            onChange={(e) => handleChange('inpreabogado', e.target.value)}
                                            placeholder="INPRE-123456"
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
                                            <Building2 size={14} /> Tipo de Relación
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
                                            onChange={(e) => handleChange('type', e.target.value as LawyerType)}
                                        >
                                            <option value="INTERNAL">💼 Interno / Planta</option>
                                            <option value="EXTERNAL">🌐 Externo / Consultor</option>
                                        </select>
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
                                        <Briefcase size={14} /> Especialidad / Área de Práctica
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem',
                                            borderRadius: '12px',
                                            border: '2px solid #e2e8f0'
                                        }}
                                        value={formData.specialty}
                                        onChange={(e) => handleChange('specialty', e.target.value)}
                                        placeholder="Ej. Derecho Corporativo, Tributario, Laboral..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Status */}
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
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                    borderRadius: '12px',
                                    color: '#fff'
                                }}>
                                    <UserCheck size={20} />
                                </div>
                                <h3 style={{
                                    fontSize: '1.1rem',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    margin: 0
                                }}>
                                    Estado del Perfil
                                </h3>
                            </div>

                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                cursor: 'pointer',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                padding: '1rem 1.25rem',
                                borderRadius: '12px',
                                transition: 'background 0.2s',
                                border: '2px solid #e2e8f0'
                            }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => handleChange('isActive', e.target.checked)}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                                <div>
                                    <div style={{ color: formData.isActive ? '#10b981' : '#64748b', fontWeight: 700 }}>
                                        {formData.isActive ? '✅ Activo y Disponible' : '⏸️ Inactivo'}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                        {formData.isActive ? 'El profesional puede recibir asignaciones' : 'No aparecerá en listados de asignación'}
                                    </div>
                                </div>
                            </label>
                        </div>

                    </form>
                </div>

                {/* Modern Footer */}
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
                        {initialData ? '⚡ Modificando perfil profesional' : '✨ Añadiendo nuevo miembro al equipo'}
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
                            form="lawyer-form"
                            className="btn-primary"
                            style={{
                                padding: '0.75rem 2rem',
                                background: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
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
                            <Save size={18} /> {initialData ? 'Actualizar Perfil' : 'Agregar Profesional'}
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
