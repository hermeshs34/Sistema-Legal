import React, { useState, useEffect } from 'react';
import {
    Settings, Database, Shield, CheckCircle2, AlertTriangle, Activity, Bell,
    Mail, Phone, RefreshCw, Lock, Clock, Key, ShieldCheck, ShieldOff, Save
} from 'lucide-react';
import { legalKnowledgeService } from './legal-knowledge.service.ts';
import { notificationService } from './notification.service.ts';
import { ClientPortalManager } from '../contracts/ClientPortalManager.tsx';
import { securityConfigService, type SecurityConfig } from './security-config.service.ts';
import { authService } from '../../core/auth.service.ts';

const MFA_CONFIGURABLE_ROLES = [
    { key: 'consultor_general', label: 'Consultor General (Admin)' },
    { key: 'abogado_senior',    label: 'Abogado Senior' },
    { key: 'gerente_firma',     label: 'Gerente de Firma' },
];

export const AdminSettingsView: React.FC = () => {
    const [seeding, setSeeding] = useState(false);
    const [seedComplete, setSeedComplete] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        email: 'legal@legaltech-ve.com',
        phone: '+58 412 1234567'
    });

    // ── Seguridad ─────────────────────────────────────────────────────────────
    const [secConfig, setSecConfig]       = useState<SecurityConfig | null>(null);
    const [secLoading, setSecLoading]     = useState(true);
    const [secSaving, setSecSaving]       = useState(false);
    const [secMsg, setSecMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    useEffect(() => {
        const user = authService.getCurrentUser();
        if (!user?.organizationId) { setSecLoading(false); return; }
        securityConfigService.getOrDefault(user.organizationId)
            .then(cfg => setSecConfig(cfg))
            .catch(() => setSecMsg({ type: 'err', text: 'No se pudo cargar la configuración de seguridad.' }))
            .finally(() => setSecLoading(false));
    }, []);

    const toggleMfaRole = (role: string) => {
        if (!secConfig) return;
        const current = secConfig.mfa_roles_enabled;
        const next = current.includes(role)
            ? current.filter(r => r !== role)
            : [...current, role];
        setSecConfig({ ...secConfig, mfa_roles_enabled: next });
    };

    const handleSaveSecurity = async () => {
        if (!secConfig) return;
        const user = authService.getCurrentUser();
        if (!user?.organizationId) return;
        setSecSaving(true); setSecMsg(null);
        try {
            const updated = await securityConfigService.update(
                user.organizationId, user.id,
                {
                    mfa_roles_enabled:      secConfig.mfa_roles_enabled,
                    session_timeout_minutos: secConfig.session_timeout_minutos,
                    password_vigencia_dias:  secConfig.password_vigencia_dias,
                    password_aviso_dias:     secConfig.password_aviso_dias,
                }
            );
            setSecConfig(updated);
            setSecMsg({ type: 'ok', text: 'Configuración de seguridad guardada correctamente.' });
        } catch (err: any) {
            setSecMsg({ type: 'err', text: err.message || 'Error al guardar.' });
        } finally {
            setSecSaving(false);
        }
    };

    const handleSeedKnowledge = async () => {
        setSeeding(true);
        try {
            await legalKnowledgeService.seedBaseKnowledge();
            setSeedComplete(true);
            alert('Sincronización exitosa: Leyes base y Jurisprudencia TSJ indexadas en el motor RAG.');
        } catch (err: any) {
            console.error(err);
            alert('Error en sincronización: ' + err.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleTestAlert = async () => {
        try {
            const success = await notificationService.sendSmsAlert(
                alertConfig.phone, 
                'Prueba de Alerta LegalDoc VE: Sistema de trazabilidad forense activo y verificado.'
            );
            if (success) {
                alert('Solicitud de notificación enviada con éxito al canal configurado.');
            } else {
                alert('El servicio de alertas respondió con éxito pero el envío podría estar demorado.');
            }
        } catch (err: any) {
            alert('Error al disparar alerta: ' + err.message);
        }
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <Settings size={28} color="var(--legal-900)" />
                <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
                    Panel de Administración LegalTech
                </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', maxWidth: '1200px' }}>
                
                {/* 1. Infraestructura de Conocimiento (RAG) */}
                <div className="premium-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                            <Database size={24} color="#6366f1" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Inteligencia TSJ y Leyes Base</h3>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '2rem', lineHeight: '1.5' }}>
                        Indexación masiva de jurisprudencia venezolana y leyes base para el motor RAG de la IA.
                    </p>
                    <button
                        onClick={handleSeedKnowledge}
                        disabled={seeding || seedComplete}
                        style={{
                            width: '100%', padding: '1rem', borderRadius: '12px',
                            background: seedComplete ? '#f0fdf4' : seeding ? '#f1f5f9' : '#6366f1',
                            color: seedComplete ? '#166534' : seeding ? '#94a3b8' : '#fff',
                            border: 'none', fontWeight: 700, cursor: seeding || seedComplete ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        {seeding ? <Activity size={20} className="animate-spin" /> : seedComplete ? <CheckCircle2 size={20} /> : <RefreshCw size={20} />}
                        {seeding ? 'Sincronizando Leyes...' : seedComplete ? 'Jurisprudencia Sincronizada' : 'Sincronizar TSJ y Gacetas'}
                    </button>
                </div>

                {/* 2. Configuración de Alertas y Notificaciones (SMS/EMAIL) */}
                <div className="premium-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
                            <Bell size={24} color="#ef4444" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Canales de Alerta Crítica</h3>
                    </div>
                    
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                <Mail size={16} /> Correo de Auditoría
                            </label>
                            <input 
                                className="premium-input" 
                                style={{ width: '100%' }}
                                value={alertConfig.email}
                                onChange={(e) => setAlertConfig({...alertConfig, email: e.target.value})}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                <Phone size={16} /> Teléfono SMS/WhatsApp
                            </label>
                            <input 
                                className="premium-input" 
                                style={{ width: '100%' }}
                                value={alertConfig.phone}
                                onChange={(e) => setAlertConfig({...alertConfig, phone: e.target.value})}
                            />
                        </div>
                        <button 
                            className="btn-primary" 
                            style={{ 
                                background: '#0f172a', 
                                padding: '1rem', 
                                borderRadius: '12px',
                                color: 'white',
                                border: 'none',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                            onClick={handleTestAlert}
                        >
                            Disparar Prueba de Alerta
                        </button>
                    </div>
                </div>

                {/* 3. Portal de Cliente */}
                <div className="premium-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
                    <ClientPortalManager />
                </div>

                {/* 4. Seguridad y Acceso */}
                <div className="premium-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                            <Lock size={24} color="#6366f1" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Seguridad y Control de Acceso</h3>
                    </div>

                    {secLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                            <Activity size={20} className="animate-spin" style={{ display: 'inline-block', marginRight: '8px' }} />
                            Cargando configuración...
                        </div>
                    ) : secConfig ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>

                            {/* MFA por Rol */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Key size={16} color="#6366f1" />
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>Autenticación MFA por Rol</span>
                                </div>

                                {/* Hardcoded roles */}
                                <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem', fontStyle: 'italic' }}>
                                    Roles regulatorios (siempre activo — no modificable):
                                </p>
                                {secConfig.mfa_roles_hardcoded.map(role => (
                                    <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', background: '#f8fafc', borderRadius: '8px', marginBottom: '6px', border: '1px solid #e2e8f0' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#475569' }}>{role}</span>
                                        <ShieldCheck size={18} color="#6366f1" />
                                    </div>
                                ))}

                                {/* Configurable roles */}
                                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '1rem 0 0.75rem', fontStyle: 'italic' }}>
                                    Roles configurables por el administrador:
                                </p>
                                {MFA_CONFIGURABLE_ROLES.map(({ key, label }) => {
                                    const enabled = secConfig.mfa_roles_enabled.includes(key);
                                    return (
                                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', background: enabled ? 'rgba(99,102,241,0.05)' : '#f8fafc', borderRadius: '8px', marginBottom: '6px', border: `1px solid ${enabled ? '#c7d2fe' : '#e2e8f0'}`, cursor: 'pointer', transition: 'all 0.15s' }} onClick={() => toggleMfaRole(key)}>
                                            <span style={{ fontSize: '0.85rem', color: '#334155' }}>{label}</span>
                                            {enabled
                                                ? <ShieldCheck size={18} color="#6366f1" />
                                                : <ShieldOff size={18} color="#94a3b8" />
                                            }
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Sesión y Contraseña */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                        <Clock size={16} /> Tiempo de Sesión (minutos)
                                    </label>
                                    <input
                                        type="number" min={15} max={480}
                                        className="premium-input"
                                        style={{ width: '100%' }}
                                        value={secConfig.session_timeout_minutos}
                                        onChange={e => setSecConfig({ ...secConfig, session_timeout_minutos: Number(e.target.value) })}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Rango: 15 – 480 minutos</span>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                        <Lock size={16} /> Vigencia de Contraseña (días)
                                    </label>
                                    <input
                                        type="number" min={30} max={365}
                                        className="premium-input"
                                        style={{ width: '100%' }}
                                        value={secConfig.password_vigencia_dias}
                                        onChange={e => setSecConfig({ ...secConfig, password_vigencia_dias: Number(e.target.value) })}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Rango: 30 – 365 días</span>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
                                        <Bell size={16} /> Aviso previo al vencimiento (días)
                                    </label>
                                    <input
                                        type="number" min={5} max={30}
                                        className="premium-input"
                                        style={{ width: '100%' }}
                                        value={secConfig.password_aviso_dias}
                                        onChange={e => setSecConfig({ ...secConfig, password_aviso_dias: Number(e.target.value) })}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Rango: 5 – 30 días</span>
                                </div>
                            </div>

                            {/* Guardar */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '1rem' }}>
                                {secMsg && (
                                    <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: secMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2', border: `1px solid ${secMsg.type === 'ok' ? '#bbf7d0' : '#fecaca'}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {secMsg.type === 'ok'
                                            ? <CheckCircle2 size={16} color="#16a34a" />
                                            : <AlertTriangle size={16} color="#dc2626" />
                                        }
                                        <span style={{ fontSize: '0.85rem', color: secMsg.type === 'ok' ? '#15803d' : '#b91c1c' }}>{secMsg.text}</span>
                                    </div>
                                )}
                                <button
                                    onClick={handleSaveSecurity}
                                    disabled={secSaving}
                                    style={{ padding: '1rem', borderRadius: '12px', background: secSaving ? '#f1f5f9' : '#6366f1', color: secSaving ? '#94a3b8' : '#fff', border: 'none', fontWeight: 700, cursor: secSaving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s' }}
                                >
                                    {secSaving ? <Activity size={18} className="animate-spin" /> : <Save size={18} />}
                                    {secSaving ? 'Guardando...' : 'Guardar Configuración de Seguridad'}
                                </button>
                            </div>

                        </div>
                    ) : (
                        <p style={{ color: '#dc2626', fontSize: '0.9rem' }}>No se pudo cargar la configuración de seguridad.</p>
                    )}
                </div>

                {/* 5. Gobernanza y Compliance Dashboard */}
                <div className="premium-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px' }}>
                            <Shield size={24} color="#f59e0b" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Transparencia Legal</h3>
                    </div>
                    <div style={{ background: '#fff7ed', padding: '1.25rem', borderRadius: '12px', border: '1px solid #ffedd5' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <AlertTriangle size={18} color="#d97706" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#92400e' }}>TRAZABILIDAD FORENSE</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#b45309', lineHeight: '1.4' }}>
                            Los logs de Auditoría y el registro de FinOps están enlazados. Cualquier desviación en el uso de IA disparará una alerta al canal configurado.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
};
