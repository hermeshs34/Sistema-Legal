/**
 * RgpdConsentBanner.tsx
 * FASE 1 — Banner de consentimiento RGPD
 *
 * Se muestra al usuario la primera vez que inicia sesión (o cuando se actualiza
 * la política de privacidad). Bloquea el acceso al sistema hasta obtener el
 * consentimiento explícito, conforme a RGPD Art. 7 y LOPDGDD.
 */

import React, { useState } from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { rgpdService } from '../../core/rgpd.service.ts';
import type { User } from '../../core/user.types.ts';

interface RgpdConsentBannerProps {
    user: User;
    onAccepted: () => void;
}

export const RgpdConsentBanner: React.FC<RgpdConsentBannerProps> = ({ user, onAccepted }) => {
    const [checked, setChecked] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState('');

    const handleAccept = async () => {
        if (!checked) return;
        setIsAccepting(true);
        setError('');
        try {
            await rgpdService.grantConsent(user.id, user.organizationId || '');
            onAccepted();
        } catch (e) {
            setError('Error al registrar el consentimiento. Por favor intente de nuevo.');
        } finally {
            setIsAccepting(false);
        }
    };

    const handleDownloadPolicy = () => {
        // En producción, esto abriría el PDF de la política de privacidad
        // Por ahora abre una ventana con el resumen
        const policyWindow = window.open('', '_blank');
        if (!policyWindow) return;
        policyWindow.document.write(`
            <!DOCTYPE html><html lang="es"><head>
            <meta charset="UTF-8">
            <title>Política de Privacidad — LegalDoc VE</title>
            <style>
                body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; 
                       color: #0f172a; line-height: 1.7; padding: 0 20px; }
                h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
                h2 { color: #1e40af; margin-top: 2rem; }
                .badge { display: inline-block; padding: 4px 12px; background: #eff6ff; 
                         border: 1px solid #bfdbfe; border-radius: 4px; font-size: 0.8rem;
                         color: #1d4ed8; font-weight: bold; margin-bottom: 1rem; }
            </style></head><body>
            <h1>⚖️ Política de Privacidad</h1>
            <div class="badge">Versión v1.0-2026 · RGPD Conforme</div>
            <p><strong>LegalDoc VE</strong> trata sus datos personales de conformidad con el Reglamento (UE) 2016/679 
            (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos Personales (LOPDGDD).</p>

            <h2>1. Responsable del Tratamiento</h2>
            <p>LegalDoc VE - Sistema de Gestión Legal y Compliance</p>

            <h2>2. Finalidad del Tratamiento</h2>
            <p>Los datos se tratan para: gestión de contratos y documentos legales, cumplimiento normativo,
            auditoría interna, y prestación de los servicios contratados.</p>

            <h2>3. Base Legal</h2>
            <p>Consentimiento explícito del interesado (Art. 6.1.a RGPD) y ejecución de contrato (Art. 6.1.b RGPD).</p>

            <h2>4. Derechos del Interesado</h2>
            <p>Usted tiene derecho a: acceso, rectificación, supresión, oposición, portabilidad y limitación del tratamiento.
            Puede ejercerlos contactando al administrador del sistema o usando la función 
            "Exportar mis datos" disponible en su perfil.</p>

            <h2>5. Conservación</h2>
            <p>Los datos se conservan durante la vigencia de la relación contractual y el período legal obligatorio 
            de conservación de documentos mercantiles (6 años, Código de Comercio).</p>

            <h2>6. Transferencias Internacionales</h2>
            <p>Los datos pueden ser tratados en servidores de Supabase (AWS). Las transferencias fuera de la UE 
            están cubiertas por cláusulas contractuales estándar aprobadas por la Comisión Europea.</p>

            <h2>7. Contacto DPO</h2>
            <p>Para cualquier cuestión relacionada con el tratamiento de sus datos, contacte al administrador del sistema.</p>

            <p style="color:#94a3b8; font-size:0.85rem; margin-top:3rem;">
                Versión v1.0-2026 · Generado el ${new Date().toLocaleDateString('es-VE')}
            </p>
            </body></html>
        `);
        policyWindow.document.close();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1.5rem',
        }}>
            <div style={{
                width: '100%', maxWidth: '560px',
                background: 'white', borderRadius: '20px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                    color: 'white',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                }}>
                    <div style={{ padding: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '12px' }}>
                        <ShieldCheck size={28} />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                            Privacidad y Protección de Datos
                        </h2>
                        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                            Conforme a RGPD (UE) 2016/679 · Versión v1.0-2026
                        </p>
                    </div>
                </div>

                {/* Cuerpo */}
                <div style={{ padding: '1.75rem 2rem' }}>
                    <p style={{ margin: '0 0 1rem', color: '#334155', fontSize: '0.9rem', lineHeight: 1.6 }}>
                        Bienvenido/a, <strong>{user.name}</strong>. Antes de acceder al sistema,
                        necesitamos su consentimiento para el tratamiento de sus datos personales
                        de acuerdo con nuestra Política de Privacidad.
                    </p>

                    {/* Derechos clave */}
                    <div style={{
                        background: '#f0fdf4', border: '1px solid #bbf7d0',
                        borderRadius: '10px', padding: '1rem 1.25rem',
                        marginBottom: '1.25rem',
                    }}>
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 700, color: '#166534', fontSize: '0.84rem' }}>
                            Sus derechos RGPD (Arts. 13-22):
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '0.78rem', color: '#15803d' }}>
                            <span>✓ Acceso a sus datos</span>
                            <span>✓ Rectificación</span>
                            <span>✓ Supresión ("derecho al olvido")</span>
                            <span>✓ Portabilidad</span>
                            <span>✓ Oposición al tratamiento</span>
                            <span>✓ Retirar consentimiento</span>
                        </div>
                    </div>

                    {/* Descarga de política */}
                    <button
                        onClick={handleDownloadPolicy}
                        style={{
                            width: '100%', padding: '0.65rem 1rem',
                            border: '1.5px solid #e2e8f0', borderRadius: '10px',
                            background: '#f8fafc', color: '#475569',
                            fontSize: '0.84rem', fontWeight: 600,
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            gap: '0.5rem', marginBottom: '1.25rem',
                        }}
                    >
                        <ExternalLink size={15} />
                        Leer Política de Privacidad Completa
                    </button>

                    {/* Checkbox de consentimiento */}
                    <label style={{
                        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                        cursor: 'pointer', marginBottom: '1.5rem',
                    }}>
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => setChecked(e.target.checked)}
                            style={{ marginTop: '3px', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#1e40af' }}
                        />
                        <span style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.5 }}>
                            He leído y comprendo la Política de Privacidad. <strong>Otorgo mi consentimiento expreso</strong> para
                            el tratamiento de mis datos personales con las finalidades descritas (gestión legal, compliance y auditoría).
                        </span>
                    </label>

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: '0.75rem', background: '#fef2f2',
                            border: '1px solid #fecaca', borderRadius: '8px',
                            fontSize: '0.82rem', color: '#b91c1c',
                            marginBottom: '1rem',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Botón aceptar */}
                    <button
                        onClick={handleAccept}
                        disabled={!checked || isAccepting}
                        style={{
                            width: '100%', padding: '0.9rem',
                            borderRadius: '12px', border: 'none',
                            background: checked
                                ? 'linear-gradient(135deg, #1e3a8a, #2563eb)'
                                : '#e2e8f0',
                            color: checked ? 'white' : '#94a3b8',
                            fontWeight: 700, fontSize: '0.95rem',
                            cursor: checked ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            boxShadow: checked ? '0 8px 20px rgba(37,99,235,0.3)' : 'none',
                        }}
                    >
                        {isAccepting ? 'Registrando consentimiento…' : 'Aceptar y Acceder al Sistema'}
                    </button>

                    <p style={{ margin: '1rem 0 0', fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                        Su consentimiento queda registrado con marca de tiempo para cumplimiento legal.
                        Puede retirarlo en cualquier momento desde su perfil de usuario.
                    </p>
                </div>
            </div>
        </div>
    );
};
