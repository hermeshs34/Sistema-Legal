import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, Camera, Info, Upload, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { userService } from './user.service.ts';
import type { User as AppUser, UserRole } from '../../core/user.types.ts';

interface UserFormProps {
    user: AppUser | null;
    onClose: () => void;
    onSave: () => void;
}

export const UserForm: React.FC<UserFormProps> = ({ user, onClose, onSave }) => {
    const [formData, setFormData] = useState<AppUser>({
        id: '',
        name: '',
        email: '',
        role: 'abogado_junior',
        avatar: '',
        isActive: true
    });
    const [password, setPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    // Estado para cambio de contraseña en edición
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

    useEffect(() => {
        const initForm = async () => {
            if (user) {
                setFormData(user);
            } else {
                setFormData({
                    id: crypto.randomUUID(),
                    name: '',
                    email: '',
                    role: 'abogado_junior',
                    avatar: '',
                    isActive: true
                });
            }
        };
        initForm();
    }, [user]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const publicUrl = await userService.uploadAvatar(file, formData.id);
            setFormData(prev => ({ ...prev, avatar: publicUrl }));
        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Error al subir la imagen');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            // Guardar datos del perfil
            await userService.save(formData, !user ? password : undefined);

            // Si es edición y el admin quiere cambiar la contraseña
            if (user && showPasswordChange && newPassword) {
                if (newPassword !== confirmPassword) {
                    setPasswordMsg({ type: 'error', text: 'Las contraseñas no coinciden.' });
                    setIsSaving(false);
                    return;
                }
                if (newPassword.length < 6) {
                    setPasswordMsg({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
                    setIsSaving(false);
                    return;
                }
                const result = await userService.changePassword(formData.id, formData.email, newPassword);
                if (result.method === 'email') {
                    setPasswordMsg({ type: 'info', text: `Se envió un email de restablecimiento a ${formData.email}. El perfil fue guardado.` });
                    setIsSaving(false);
                    setTimeout(() => onSave(), 3000);
                    return;
                }
            }
            onSave();
        } catch (error) {
            console.error('Error saving user:', error);
            alert('Error al guardar el usuario: ' + (error instanceof Error ? error.message : 'Error desconocido'));
        } finally {
            setIsSaving(false);
        }
    };

    const roles: { value: UserRole; label: string; description: string; color: string; mfa: boolean; group: string }[] = [
        // ── Roles internos ──────────────────────────────────────────────────────
        { value: 'consultor_general',   label: 'Consultor General',   description: 'Administrador total: CRUD completo, gestión de usuarios y parámetros del sistema.',     color: '#7c3aed', mfa: true,  group: 'Internos' },
        { value: 'abogado_senior',      label: 'Abogado Senior',      description: 'Acceso completo a documentos, contratos, expedientes y aprobación de firmas.',          color: '#1d4ed8', mfa: true,  group: 'Internos' },
        { value: 'abogado_junior',      label: 'Abogado Junior',      description: 'Acceso a documentos asignados, carga de actuaciones y borradores propios.',              color: '#0369a1', mfa: false, group: 'Internos' },
        { value: 'consultor_principal', label: 'Consultor Principal', description: 'Solo lectura y exportación de reportes. Sin capacidad de edición.',                     color: '#0f766e', mfa: false, group: 'Internos' },
        { value: 'aprendiz',            label: 'Aprendiz',            description: 'Observación limitada de documentos asignados. Sin exportación.',                        color: '#6b7280', mfa: false, group: 'Internos' },
        // ── Roles regulatorios / especiales ─────────────────────────────────────
        { value: 'compliance_officer',  label: 'Compliance Officer',  description: 'AML/CFT y cumplimiento regulatorio (SUDEBAN/SUGEF). Acceso a auditoría completa y reportes regulatorios. MFA obligatorio.', color: '#b45309', mfa: true, group: 'Regulatorios' },
        { value: 'auditor_externo',     label: 'Auditor Externo',     description: 'Solo lectura de todos los módulos + exportación. Sin acceso a datos personales de clientes. MFA obligatorio.',              color: '#374151', mfa: true, group: 'Regulatorios' },
        { value: 'gerente_firma',       label: 'Gerente de Firma',    description: 'Supervisión estratégica total sin capacidad de modificación. Visibilidad de honorarios y expedientes. MFA obligatorio.',     color: '#1e3a8a', mfa: true, group: 'Directivos'  },
    ];

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
            animation: 'fadeInOverlay 0.3s ease-out'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '650px',
                background: 'white',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflowY: 'auto',
                maxHeight: '90vh',
                animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            padding: '10px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                        }}>
                            <User size={24} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                                {user ? 'Editar Usuario' : 'Nuevo Usuario Corporativo'}
                            </h3>
                            <p style={{ fontSize: '0.8125rem', opacity: 0.8, margin: 0 }}>
                                {user ? 'Actualice el perfil y permisos' : 'Configure el acceso para un nuevo miembro'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '8px' }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>

                        {/* Avatar Section */}
                        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '2.5rem', marginBottom: '1.5rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: '110px', height: '110px', borderRadius: '50%',
                                    border: '4px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    overflow: 'hidden', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {formData.avatar ? (
                                        <img
                                            src={formData.avatar}
                                            alt="Avatar"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <div style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 800 }}>
                                            {formData.name ? formData.name.charAt(0).toUpperCase() : <User size={48} />}
                                        </div>
                                    )}
                                    {uploading && (
                                        <div style={{
                                            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
                                        }}>
                                            <Loader2 size={24} className="spin" />
                                        </div>
                                    )}
                                </div>
                                <label style={{
                                    position: 'absolute', bottom: '-5px', right: '-5px',
                                    background: '#1e3a8a', color: 'white', border: '2px solid #fff',
                                    padding: '8px', borderRadius: '50%', boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'transform 0.2s'
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <Camera size={18} />
                                    <input type="file" onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                                </label>
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: 700 }}>Foto de Perfil Especialista</h4>
                                <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4' }}>
                                    Cargue una fotografía profesional para la identificación en dictámenes y reportes legales.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                                    style={{
                                        padding: '0.5rem 1rem', background: '#fff', border: '1.5px solid #1e3a8a',
                                        borderRadius: '8px', color: '#1e3a8a', fontSize: '0.85rem', fontWeight: 700,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                                    }}
                                >
                                    <Upload size={14} /> Seleccionar Imagen
                                </button>
                            </div>
                        </div>

                        {/* Name Field */}
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Nombre Completo</label>
                            <div style={{ position: 'relative' }}>
                                <User style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej: Juan Pérez"
                                    className="premium-input"
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Correo Electrónico Corporativo</label>
                            <div style={{ position: 'relative' }}>
                                <Mail style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="usuario@legaltech.ve"
                                    className="premium-input"
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                                />
                            </div>
                        </div>

                        {/* Password Field: nuevo usuario */}
                        {!user && (
                            <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.5rem' }}>Contraseña de Acceso</label>
                                <div style={{ position: 'relative' }}>
                                    <Lock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                                    <input
                                        type="password"
                                        required={!user}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        className="premium-input"
                                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '12px', border: '1.5px solid #e2e8f0', fontSize: '1rem', outline: 'none' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Password Change Section: edición de usuario existente */}
                        {user && (
                            <div style={{ gridColumn: 'span 2', borderRadius: '14px', border: '1.5px solid #e2e8f0', overflow: 'hidden' }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowPasswordChange(!showPasswordChange); setPasswordMsg(null); setNewPassword(''); setConfirmPassword(''); }}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '0.875rem 1.25rem', border: 'none', cursor: 'pointer',
                                        background: showPasswordChange ? '#eff6ff' : '#f8fafc',
                                        color: showPasswordChange ? '#1d4ed8' : '#475569',
                                        fontWeight: 700, fontSize: '0.875rem', transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Lock size={16} />
                                        Cambiar Contraseña
                                    </span>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: '999px', background: showPasswordChange ? '#dbeafe' : '#e2e8f0', color: showPasswordChange ? '#1e40af' : '#64748b' }}>
                                        {showPasswordChange ? 'Cancelar' : 'Modificar'}
                                    </span>
                                </button>

                                {showPasswordChange && (
                                    <div style={{ padding: '1.25rem', background: '#f8fafc', display: 'grid', gap: '1rem' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                                                Nueva Contraseña
                                            </label>
                                            <div style={{ position: 'relative' }}>
                                                <Lock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                                <input
                                                    type="password"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="Mínimo 6 caracteres"
                                                    className="premium-input"
                                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#fff' }}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>
                                                Confirmar Nueva Contraseña
                                            </label>
                                            <div style={{ position: 'relative' }}>
                                                <Lock style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                                <input
                                                    type="password"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Repita la nueva contraseña"
                                                    className="premium-input"
                                                    style={{
                                                        width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '10px',
                                                        border: `1.5px solid ${confirmPassword && newPassword !== confirmPassword ? '#ef4444' : '#e2e8f0'}`,
                                                        fontSize: '0.95rem', outline: 'none', background: '#fff'
                                                    }}
                                                />
                                            </div>
                                            {confirmPassword && newPassword !== confirmPassword && (
                                                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#ef4444' }}>Las contraseñas no coinciden</p>
                                            )}
                                            {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                                                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#059669' }}>✓ Las contraseñas coinciden</p>
                                            )}
                                        </div>

                                        {/* Mensaje de resultado */}
                                        {passwordMsg && (
                                            <div style={{
                                                padding: '0.75rem 1rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 600,
                                                background: passwordMsg.type === 'success' ? '#f0fdf4' : passwordMsg.type === 'error' ? '#fef2f2' : '#eff6ff',
                                                color: passwordMsg.type === 'success' ? '#166534' : passwordMsg.type === 'error' ? '#b91c1c' : '#1d4ed8',
                                                border: `1px solid ${passwordMsg.type === 'success' ? '#bbf7d0' : passwordMsg.type === 'error' ? '#fecaca' : '#bfdbfe'}`
                                            }}>
                                                {passwordMsg.type === 'info' && '📧 '}
                                                {passwordMsg.type === 'error' && '⚠️ '}
                                                {passwordMsg.type === 'success' && '✅ '}
                                                {passwordMsg.text}
                                            </div>
                                        )}

                                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.4 }}>
                                            💡 Si el sistema no puede cambiar la contraseña directamente, enviará un email de restablecimiento al usuario.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Role Selection */}
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.75rem' }}>
                                Asignación de Rol y Nivel de Acceso
                            </label>
                            {/* Agrupar roles */}
                            {['Internos', 'Regulatorios', 'Directivos'].map(group => (
                                <div key={group} style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem', paddingLeft: '0.25rem' }}>
                                        {group}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                        {roles.filter(r => r.group === group).map((role) => {
                                            const isSelected = formData.role === role.value;
                                            return (
                                                <label key={role.value} style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '1rem',
                                                    padding: '0.875rem 1rem',
                                                    borderRadius: '12px',
                                                    border: isSelected ? `2px solid ${role.color}` : '1.5px solid #e2e8f0',
                                                    background: isSelected ? `${role.color}10` : 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}>
                                                    <input
                                                        type="radio"
                                                        name="role"
                                                        value={role.value}
                                                        checked={isSelected}
                                                        onChange={() => setFormData({ ...formData, role: role.value })}
                                                        style={{ marginTop: '3px' }}
                                                    />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                                            <span style={{ fontWeight: 700, color: isSelected ? role.color : '#1e293b', fontSize: '0.9rem' }}>
                                                                {role.label}
                                                            </span>
                                                            {role.mfa && (
                                                                <span title="MFA obligatorio para este rol" style={{
                                                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                                                    fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px',
                                                                    borderRadius: '999px', background: '#fef3c7', color: '#92400e',
                                                                    border: '1px solid #fde68a'
                                                                }}>
                                                                    <ShieldCheck size={10} /> MFA
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ fontSize: '0.78rem', color: isSelected ? '#475569' : '#94a3b8', lineHeight: '1.4' }}>
                                                            {role.description}
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Status Toggle */}
                        <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px' }}>
                            <Info size={20} color="#2563eb" />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>Estado de la Cuenta</div>
                                <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>Las cuentas inactivas no podrán acceder al sistema.</div>
                            </div>
                            <div
                                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                                style={{
                                    width: '50px',
                                    height: '26px',
                                    borderRadius: '13px',
                                    background: formData.isActive ? '#059669' : '#cbd5e1',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'background 0.3s'
                                }}
                            >
                                <div style={{
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    background: 'white',
                                    position: 'absolute',
                                    top: '3px',
                                    left: formData.isActive ? '27px' : '3px',
                                    transition: 'left 0.3s'
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div style={{
                        marginTop: '2.5rem',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ padding: '0.875rem 1.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            style={{
                                padding: '0.875rem 1.75rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                                color: 'white',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
                            }}
                        >
                            {isSaving ? 'Guardando...' : (
                                <>
                                    <Save size={18} />
                                    Guardar Usuario
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes fadeInOverlay {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .premium-input:focus {
                    border-color: #2563eb !important;
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1) !important;
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
