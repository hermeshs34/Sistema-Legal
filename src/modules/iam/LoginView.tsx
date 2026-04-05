import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../core/auth.service.ts';
import type { User } from '../../core/user.types.ts';

interface LoginViewProps {
    onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Por favor ingrese correo y contraseña');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const user = await authService.login(email, password);
            onLogin(user);
        } catch (err: any) {
            setError(err.message || 'Error de autenticación');
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(145deg, #1e3a8a 0%, #172554 100%)', // Deep blue gradient
            fontFamily: 'var(--font-heading)',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '420px',
                background: '#ffffff', // Pure white card
                borderRadius: '24px', // Rounded corners like reference
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)', // Deep shadow
                padding: '2.5rem',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>

                {/* Header Icon Block */}
                <div style={{
                    width: '100%',
                    background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 100%)', // Blue/Indigo gradient
                    height: '60px',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.5rem',
                    boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)'
                }}>
                    <ShieldCheck size={32} color="white" />
                </div>

                <h1 style={{
                    fontSize: '1.875rem',
                    color: '#1e3a8a', // Dark blue text
                    marginBottom: '0.25rem',
                    textAlign: 'center',
                    fontWeight: 800
                }}>
                    LegalDoc VE
                </h1>
                <p style={{
                    color: '#64748b',
                    marginBottom: '2rem',
                    fontSize: '0.95rem',
                    textAlign: 'center'
                }}>
                    Gestión Legal & Compliance Inteligente
                </p>

                <form onSubmit={handleLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            textAlign: 'center',
                            border: '1px solid #fecaca'
                        }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Correo Corporativo</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="email"
                                placeholder="correo@empresa.com"
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '1rem',
                                    color: '#1e293b',
                                    outline: 'none',
                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                    backgroundColor: '#f8fafc'
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Contraseña</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    paddingRight: '3rem',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '1rem',
                                    color: '#1e293b',
                                    outline: 'none',
                                    backgroundColor: '#f8fafc'
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)'; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'
                                }}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginTop: '0.25rem' }}>
                        <input 
                            type="checkbox" 
                            id="acceptTerms" 
                            style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '2px' }}
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                        />
                        <label htmlFor="acceptTerms" style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4', cursor: 'pointer' }}>
                            He leído y acepto los <strong>Términos de Servicio</strong>, las políticas de <strong>Protección de Datos</strong> y el uso de IA.
                        </label>
                    </div>

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            marginTop: '0.25rem',
                            background: acceptedTerms ? 'linear-gradient(to right, #2563eb, #1d4ed8)' : '#cbd5e1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: acceptedTerms ? 'pointer' : 'not-allowed',
                            boxShadow: acceptedTerms ? '0 4px 6px -1px rgba(37, 99, 235, 0.4)' : 'none',
                            transition: 'all 0.2s',
                            opacity: acceptedTerms ? 1 : 0.7
                        }}
                        disabled={isLoading || !acceptedTerms}
                    >
                        {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', width: '100%', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                        ¿Olvidó su contraseña? Contacte al administrador del sistema.
                    </p>
                </div>

            </div>
        </div>
    );
};
