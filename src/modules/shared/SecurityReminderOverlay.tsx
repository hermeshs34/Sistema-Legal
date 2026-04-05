import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface SecurityReminderOverlayProps {
    onDismiss: () => void;
    userName: string;
}

/**
 * SecurityReminderOverlay.tsx
 * Recordatorio de Confidencialidad y Sigilo Profesional (Sesión).
 * Este aviso aparece CADA VEZ que el usuario inicia sesión para reforzar la
 * responsabilidad en el manejo de expedientes sensibles.
 */
export const SecurityReminderOverlay: React.FC<SecurityReminderOverlayProps> = ({ onDismiss, userName }) => {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
        }}>
            <div style={{
                width: '100%', maxWidth: '440px',
                background: 'white', borderRadius: '24px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                padding: '2rem', textAlign: 'center',
                border: '1px solid rgba(226, 232, 240, 0.8)',
            }}>
                <div style={{ 
                    width: '64px', height: '64px', background: '#eff6ff', 
                    borderRadius: '20px', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', margin: '0 auto 1.5rem' 
                }}>
                    <ShieldCheck size={32} color="#1d4ed8" />
                </div>

                <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 800, color: '#1e3a8a' }}>
                    Compromiso de Confidencialidad
                </h2>
                <p style={{ margin: '0 0 1.5rem', fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5 }}>
                    Buen día, <strong>{userName}</strong>. Al acceder al sistema hoy, usted ratifica su compromiso con el 
                    <strong> Sigilo Profesional</strong> y el cumplimiento de la Ley sobre Protección de Datos.
                </p>

                <div style={{ 
                    background: '#f8fafc', border: '1px solid #e2e8f0', 
                    borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem',
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start', textAlign: 'left'
                }}>
                    <AlertCircle size={18} color="#6366f1" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569', lineHeight: 1.4 }}>
                        Todas las acciones dentro de la plataforma son registradas en el 
                        <strong> Audit Trail</strong> inmutable para garantizar la integridad forense de los datos.
                    </p>
                </div>

                <button
                    onClick={onDismiss}
                    style={{
                        width: '100%', padding: '1rem',
                        background: 'linear-gradient(to right, #1e3a8a, #2563eb)',
                        color: 'white', border: 'none', borderRadius: '12px',
                        fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                        boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                        transition: 'transform 0.1s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    Entendido y Acceder
                </button>

                <p style={{ marginTop: '1rem', fontSize: '0.65rem', color: '#94a3b8' }}>
                    LegalDoc VE · Trusted Legal Environment
                </p>
            </div>
        </div>
    );
};
