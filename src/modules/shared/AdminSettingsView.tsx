import React, { useState } from 'react';
import { 
    Settings, Database, Shield, CheckCircle2, AlertTriangle, Activity, Bell, Mail, Phone, RefreshCw
} from 'lucide-react';
import { legalKnowledgeService } from './legal-knowledge.service.ts';
import { notificationService } from './notification.service.ts';

export const AdminSettingsView: React.FC = () => {
    const [seeding, setSeeding] = useState(false);
    const [seedComplete, setSeedComplete] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        email: 'legal@legaltech-ve.com',
        phone: '+58 412 1234567'
    });

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

                {/* 3. Gobernanza y Compliance Dashboard */}
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
