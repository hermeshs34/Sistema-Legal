import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Eye, EyeOff, ShieldAlert, Smartphone, KeyRound, AlertTriangle } from 'lucide-react';
import { authService } from '../../core/auth.service.ts';
import type { User } from '../../core/user.types.ts';

interface LoginViewProps {
    onLogin: (user: User) => void;
}

type LoginStep = 'credentials' | 'mfa' | 'mfa_enroll';

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    const [email, setEmail]               = useState('');
    const [password, setPassword]         = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const [step, setStep]               = useState<LoginStep>('credentials');
    const [pendingUser, setPendingUser] = useState<User | null>(null);
    const [factorId, setFactorId]       = useState<string>('');
    const [mfaCode, setMfaCode]         = useState('');
    const [enrollQR, setEnrollQR]       = useState('');
    const [enrollSecret, setEnrollSecret] = useState('');
    const [enrollFactorId, setEnrollFactorId] = useState('');
    const mfaInputRef = useRef<HTMLInputElement>(null);

    const [lockoutSecs, setLockoutSecs]   = useState(0);
    const [attempts, setAttempts]         = useState(0);
    const lockoutInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    const [error, setError]       = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (step === 'mfa' || step === 'mfa_enroll') {
            setTimeout(() => mfaInputRef.current?.focus(), 100);
        }
    }, [step]);

    const startLockoutTimer = (secs: number) => {
        setLockoutSecs(secs);
        if (lockoutInterval.current) clearInterval(lockoutInterval.current);
        lockoutInterval.current = setInterval(() => {
            setLockoutSecs(prev => {
                if (prev <= 1) { clearInterval(lockoutInterval.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => () => { if (lockoutInterval.current) clearInterval(lockoutInterval.current); }, []);

    const formatTime = (secs: number): string => {
        if (secs < 60) return `${secs}s`;
        const m = Math.floor(secs / 60); const s = secs % 60;
        return s > 0 ? `${m}m ${s}s` : `${m}min`;
    };

    const isLocked = lockoutSecs > 0;

    const handleCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) { setError('Por favor ingrese correo y contraseña'); return; }
        if (!acceptedTerms)      { setError('Debe aceptar los términos para continuar'); return; }
        if (isLocked)            return;
        setIsLoading(true); setError('');
        try {
            const result = await authService.login(email, password);
            if (result.mfaRequired && result.factorId) {
                setPendingUser(result.user); setFactorId(result.factorId); setStep('mfa');
            } else if (result.enrollmentRequired) {
                setPendingUser(result.user); await startMFAEnrollment();
            } else {
                onLogin(result.user);
            }
        } catch (err: any) {
            const msg: string = err.message || '';
            if (msg.startsWith('LOCKOUT:')) {
                const secs = parseInt(msg.split(':')[1], 10);
                startLockoutTimer(secs);
                setError(`Demasiados intentos fallidos. Espere ${formatTime(secs)}.`);
            } else {
                setAttempts(authService.getAttempts(email.trim().toLowerCase()));
                setError(msg);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleMFAVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaCode || mfaCode.length < 6) { setError('Ingrese el código de 6 dígitos'); return; }
        if (!pendingUser || !factorId) return;
        setIsLoading(true); setError('');
        try {
            const user = await authService.verifyMFA(factorId, mfaCode, pendingUser);
            onLogin(user);
        } catch (err: any) {
            setError(err.message || 'Código MFA incorrecto'); setMfaCode('');
        } finally {
            setIsLoading(false);
        }
    };

    const startMFAEnrollment = async () => {
        try {
            const { qrCode, secret, factorId: fId } = await authService.enrollMFA();
            setEnrollQR(qrCode); setEnrollSecret(secret); setEnrollFactorId(fId); setStep('mfa_enroll');
        } catch (err: any) {
            setError(err.message || 'Error iniciando configuración MFA');
        }
    };

    const handleMFAEnrollConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaCode || mfaCode.length < 6) { setError('Ingrese el código de 6 dígitos de su app'); return; }
        setIsLoading(true); setError('');
        try {
            await authService.confirmMFAEnrollment(enrollFactorId, mfaCode);
            if (pendingUser) {
                authService.saveSession(pendingUser);
                onLogin(pendingUser);
            }
        } catch (err: any) {
            setError(err.message || 'Error confirmando MFA'); setMfaCode('');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Estilos inline (LegalTech no usa Tailwind CSS) ───────────────────────

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.875rem 1rem 0.875rem 2.75rem',
        borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)',
        fontSize: '0.9rem', color: '#ffffff', outline: 'none',
        backgroundColor: 'rgba(255,255,255,0.05)', boxSizing: 'border-box',
        transition: 'border-color 0.2s',
    };

    const btnPrimary = (disabled: boolean): React.CSSProperties => ({
        width: '100%', padding: '1rem', marginTop: '0.25rem',
        background: disabled ? '#334155' : 'linear-gradient(135deg, #0f3460, #1a5276)',
        color: disabled ? '#64748b' : '#f59e0b',
        border: 'none', borderRadius: '12px', fontSize: '0.9rem',
        fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '0.08em', textTransform: 'uppercase' as const,
        boxShadow: disabled ? 'none' : '0 8px 32px rgba(15,52,96,0.4)',
        transition: 'all 0.2s',
    });

    // ── Render paso CREDENCIALES ──────────────────────────────────────────────
    const renderCredentials = () => (
        <form onSubmit={handleCredentials} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isLocked && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={16} color="#fbbf24" />
                    <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>Acceso bloqueado — {formatTime(lockoutSecs)}</span>
                </div>
            )}
            {!isLocked && attempts > 0 && attempts < 5 && (
                <div style={{ padding: '0.75rem', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '10px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <AlertTriangle size={15} color="#fb923c" />
                    <span style={{ fontSize: '0.78rem', color: '#fb923c' }}>Intento {attempts}/5 — la cuenta se bloqueará al 5°.</span>
                </div>
            )}
            {error && !isLocked && (
                <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#f87171', fontSize: '0.82rem', textAlign: 'center' }}>
                    {error}
                </div>
            )}

            <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Correo Corporativo</label>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '0.9rem' }}>✉</span>
                    <input type="email" placeholder="correo@empresa.com" style={inputStyle}
                        value={email} onChange={e => setEmail(e.target.value)} disabled={isLocked}
                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'}
                        onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                    />
                </div>
            </div>

            <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Contraseña</label>
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>🔒</span>
                    <input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                        style={{ ...inputStyle, paddingRight: '3rem' }}
                        value={password} onChange={e => setPassword(e.target.value)} disabled={isLocked}
                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.5)'}
                        onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 0 }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                <input type="checkbox" id="acceptTerms" checked={acceptedTerms}
                    onChange={e => setAcceptedTerms(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', marginTop: '2px', accentColor: '#f59e0b' }} />
                <label htmlFor="acceptTerms" style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4, cursor: 'pointer' }}>
                    He leído y acepto los <strong style={{ color: '#94a3b8' }}>Términos de Servicio</strong>, políticas de <strong style={{ color: '#94a3b8' }}>Protección de Datos</strong> y uso de IA.
                </label>
            </div>

            <button type="submit" style={btnPrimary(isLoading || !acceptedTerms || isLocked)} disabled={isLoading || !acceptedTerms || isLocked}>
                {isLoading ? 'Verificando...' : isLocked ? `Bloqueado (${formatTime(lockoutSecs)})` : 'Iniciar Sesión'}
            </button>
        </form>
    );

    // ── Render paso MFA VERIFICACIÓN ─────────────────────────────────────────
    const renderMFAVerify = () => (
        <form onSubmit={handleMFAVerify} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '12px', textAlign: 'center' }}>
                <Smartphone size={28} color="#60a5fa" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.9rem', color: '#93c5fd', margin: 0, fontWeight: 600 }}>Verificación en dos pasos</p>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0' }}>Abra su app autenticadora e ingrese el código de 6 dígitos.</p>
            </div>
            {error && <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#f87171', fontSize: '0.82rem', textAlign: 'center' }}>{error}</div>}
            <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Código de verificación</label>
                <input ref={mfaInputRef} type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} placeholder="_ _ _ _ _ _"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '1.75rem', letterSpacing: '0.5rem', fontWeight: 700, paddingLeft: '1rem' }}
                    value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                />
            </div>
            <button type="submit" style={btnPrimary(isLoading || mfaCode.length < 6)} disabled={isLoading || mfaCode.length < 6}>
                {isLoading ? 'Verificando...' : 'Confirmar Código'}
            </button>
            <button type="button" onClick={() => { setStep('credentials'); setPendingUser(null); setMfaCode(''); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline' }}>
                ← Volver al inicio de sesión
            </button>
        </form>
    );

    // ── Render paso MFA ENROLAMIENTO ─────────────────────────────────────────
    const renderMFAEnroll = () => (
        <form onSubmit={handleMFAEnrollConfirm} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', textAlign: 'center' }}>
                <KeyRound size={24} color="#fbbf24" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.85rem', color: '#fbbf24', margin: 0, fontWeight: 700 }}>Configure su autenticador MFA</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0' }}>Su rol requiere verificación en dos pasos. Se configura una sola vez.</p>
            </div>
            {enrollQR && (
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                        1. Instale <strong style={{ color: '#e2e8f0' }}>Google Authenticator</strong> o <strong style={{ color: '#e2e8f0' }}>Authy</strong><br/>
                        2. Escanee el código QR
                    </p>
                    <img src={enrollQR} alt="QR MFA" style={{ width: '160px', height: '160px', border: '3px solid rgba(255,255,255,0.1)', borderRadius: '12px', margin: '0 auto', display: 'block' }} />
                    {enrollSecret && (
                        <div style={{ marginTop: '0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.5rem', fontSize: '0.73rem', color: '#64748b' }}>
                            Clave manual: <code style={{ fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.1rem' }}>{enrollSecret}</code>
                        </div>
                    )}
                </div>
            )}
            {error && <div style={{ padding: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', color: '#f87171', fontSize: '0.82rem', textAlign: 'center' }}>{error}</div>}
            <div>
                <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 800, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.12em' }}>3. Código generado por la app</label>
                <input ref={mfaInputRef} type="text" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} placeholder="_ _ _ _ _ _"
                    style={{ ...inputStyle, textAlign: 'center', fontSize: '1.75rem', letterSpacing: '0.5rem', fontWeight: 700, paddingLeft: '1rem' }}
                    value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                />
            </div>
            <button type="submit" style={btnPrimary(isLoading || mfaCode.length < 6)} disabled={isLoading || mfaCode.length < 6}>
                {isLoading ? 'Configurando...' : 'Activar Autenticador'}
            </button>
        </form>
    );

    const stepTitle: Record<LoginStep, string> = {
        credentials: 'Acceso al Sistema',
        mfa: 'Verificación MFA',
        mfa_enroll: 'Configurar Autenticador',
    };
    const stepSubtitle: Record<LoginStep, string> = {
        credentials: 'Ingrese sus credenciales corporativas para continuar',
        mfa: `Bienvenido, ${pendingUser?.name || ''}`,
        mfa_enroll: 'Configure su autenticador de dos factores',
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', overflow: 'hidden', background: '#0a0f1e', fontFamily: 'var(--font-heading, system-ui, sans-serif)' }}>

            {/* ── Panel izquierdo — solo desktop (≥1024px) ── */}
            <div style={{
                display: 'none',
                width: '50%', flexDirection: 'column', justifyContent: 'space-between',
                padding: '3.5rem', position: 'relative', flexShrink: 0,
            }} className="lg-left-panel">
                {/* fondo grid */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }} xmlns="http://www.w3.org/2000/svg">
                    <defs><pattern id="lgrid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="1"/></pattern></defs>
                    <rect width="100%" height="100%" fill="url(#lgrid)" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 20% 50%, rgba(15,52,96,0.6) 0%, transparent 70%)' }} />

                {/* Logo */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <img src="/hermesai-logo.svg" alt="HermesAI"
                        style={{ height: '48px', width: 'auto', objectFit: 'contain', display: 'block' }} />
                    <p style={{ color: '#475569', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '0.25rem' }}>
                        Legal & Compliance Platform
                    </p>
                </div>

                {/* Contenido central */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.75rem', borderRadius: '999px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: '2rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
                        <span style={{ color: '#f59e0b', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>MFA Activo · Auditoría SHA-256</span>
                    </div>
                    <h2 style={{ fontSize: '3rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.15, marginBottom: '1.5rem' }}>
                        Gestión<br />
                        <span style={{ color: '#f59e0b' }}>Legal</span> &<br />
                        Compliance
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: '340px' }}>
                        Plataforma integral de gestión documental legal, cumplimiento AML/CFT
                        y control regulatorio con auditoría inmutable.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '2rem' }}>
                        {['LORCAIDOFT', 'OFAC / ONU', 'GAFI / AML', 'Compliance VE'].map(b => (
                            <span key={b} style={{ padding: '0.25rem 0.75rem', borderRadius: '8px', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {b}
                            </span>
                        ))}
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p style={{ color: '#1e293b', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        © 2026 HermesAI Technologies — Confidencial
                    </p>
                </div>
            </div>

            {/* ── Panel derecho — Formulario ── */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: '2rem',
                background: 'rgba(255,255,255,0.02)', borderLeft: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ width: '100%', maxWidth: '380px' }}>

                    {/* Logo móvil */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem' }} className="mobile-logo">
                        <img src="/hermesai-logo.svg" alt="HermesAI"
                            style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
                        <p style={{ color: '#475569', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '0.25rem' }}>
                            Legal & Compliance Platform
                        </p>
                    </div>

                    {/* Título */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h1 style={{ fontSize: '1.5rem', color: '#ffffff', fontWeight: 900, margin: '0 0 0.25rem' }}>
                            {stepTitle[step]}
                        </h1>
                        <p style={{ color: '#475569', fontSize: '0.875rem', margin: 0 }}>{stepSubtitle[step]}</p>
                    </div>

                    {step === 'credentials' && renderCredentials()}
                    {step === 'mfa'         && renderMFAVerify()}
                    {step === 'mfa_enroll'  && renderMFAEnroll()}

                    {/* Footer */}
                    <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                            <ShieldCheck size={12} color="#10b981" />
                            <span style={{ fontSize: '0.65rem', color: '#334155' }}>Conexión cifrada SSL · Sesión segura · Auditoría SHA-256</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <p style={{ fontSize: '0.65rem', color: '#1e293b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>HermesAI Technologies</p>
                            <p style={{ fontSize: '0.65rem', color: '#1e293b', fontWeight: 800, margin: 0 }}>LegalDoc VE</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS para mostrar el panel izquierdo en desktop */}
            <style>{`
                @media (min-width: 1024px) {
                    .lg-left-panel { display: flex !important; }
                    .mobile-logo { display: none !important; }
                }
            `}</style>
        </div>
    );
};
