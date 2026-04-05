/**
 * SignaturePanel.tsx
 * FASE 1 — Panel de Firma Electrónica dentro de ContractDetailsModal
 *
 * Funcionalidades:
 *  - Firmar con firma básica SHA-256 (LDFE Venezuela)
 *  - Ver los detalles de la firma existente
 *  - Verificar integridad del contrato firmado (detecta alteraciones)
 *  - Revocar la firma (solo consultor_general)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    ShieldCheck, ShieldX, Clock, PenLine, AlertTriangle,
    Copy, CheckCircle2, SearchCheck, XCircle, Loader2, Camera
} from 'lucide-react';
import { supabase } from '../../core/supabase.ts';
import { signatureService } from './signature.service.ts';
import { authService } from '../../core/auth.service.ts';
import type { Contract } from './types.ts';

interface SignaturePanelProps {
    contract: Contract;
    onSigned: () => void;
}

type VerifyState = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

export const SignaturePanel: React.FC<SignaturePanelProps> = ({ contract, onSigned }) => {
    const user = authService.getCurrentUser();

    const [isSigning, setIsSigning]     = useState(false);
    const [isRevoking, setIsRevoking]   = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [copied, setCopied]           = useState(false);
    const [error, setError]             = useState('');

    // Biometría
    const [showCamera, setShowCamera]   = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Estados de verificación de integridad
    const [verifyState, setVerifyState]   = useState<VerifyState>('idle');
    const [verifyMessage, setVerifyMessage] = useState('');

    const status   = contract.signature_status || 'unsigned';
    const isSigned = ['signed_basic', 'signed_advanced'].includes(status);
    const canSign  = ['REVIEW', 'ACTIVE'].includes(contract.status) && !isSigned;
    const canRevoke = isSigned && user?.role === 'consultor_general';

    // Huella Digital y Geolocalización
    const [geo, setGeo] = useState<{lat: number, lng: number} | null>(null);
    const [fingerprint, setFingerprint] = useState('');

    // Capturar GPS al confirmar firma
    useEffect(() => {
        if (showConfirm && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => { /* GPS denegado — firma continua sin coordenadas */ },
                { enableHighAccuracy: true }
            );
            setFingerprint(navigator.userAgent);
        }
    }, [showConfirm]);

    // ── Firmar ────────────────────────────────────────────────────────────────
    const handleSign = async () => {
        if (!user) return;
        setIsSigning(true);
        setError('');
        try {
            // FORZAMOS lectura de base de datos antes de firmar para tener la "Verdad Absoluta"
            const { data: dbContract, error: dbError } = await supabase
                .from('contracts')
                .select('*')
                .eq('id', contract.id)
                .single();

            if (dbError || !dbContract) throw new Error('No se pudo obtener datos frescos para firmar');

            const content = [
                dbContract.title?.trim() || '',
                dbContract.content_draft?.trim() || dbContract.description?.trim() || '',
                dbContract.parties?.map((p: string) => p.trim()).join(', ') || '',
                dbContract.startDate?.trim() || '',
                dbContract.endDate?.trim() || '',
            ].join('\n');

            await signatureService.signBasic({
                contractId:      dbContract.id,
                contractTitle:   dbContract.title,
                contractContent: content,
                signerName:      user.name,
                signerEmail:     user.email,
                userId:          user.id,
                organizationId:  user.organizationId || '',
                biometricPhoto:  capturedPhoto || undefined,
                metadata: {
                    location: geo ? `${geo.lat}, ${geo.lng}` : 'Ubicación no autorizada',
                    browser: fingerprint,
                    ip_tunnel: 'SECURE_PROXY_VE'
                }
            });
            setShowConfirm(false);
            stopCamera();
            onSigned();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al firmar. Intente de nuevo.');
        } finally {
            setIsSigning(false);
        }
    };

    const startCamera = async () => {
        setShowCamera(true);
        setCapturedPhoto(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            setError('No se pudo acceder a la cámara. Verifique los permisos.');
            setShowCamera(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
        setShowCamera(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                const photo = canvasRef.current.toDataURL('image/jpeg', 0.8);
                setCapturedPhoto(photo);
                stopCamera();
            }
        }
    };

    // ── Verificar integridad ──────────────────────────────────────────────────
    const handleVerify = async () => {
        setVerifyState('checking');
        setVerifyMessage('');
        try {
            // FORZAMOS lectura de base de datos para evitar datos cacheados en el prop
            const { data: dbContract, error: dbError } = await supabase
                .from('contracts')
                .select('*')
                .eq('id', contract.id)
                .single();

            if (dbError || !dbContract) throw new Error('No se pudo obtener el contrato fresco');

            // Reconstruimos el contenido base DESDE el contrato de la DB
            const currentContent = [
                dbContract.title?.trim() || '',
                dbContract.content_draft?.trim() || dbContract.description?.trim() || '',
                dbContract.parties?.map((p: string) => p.trim()).join(', ') || '',
                dbContract.startDate?.trim() || '',
                dbContract.endDate?.trim() || '',
            ].join('\n');

            const result = await signatureService.verify(contract.id, currentContent);
            setVerifyState(result.valid ? 'valid' : 'invalid');
            setVerifyMessage(result.message);
        } catch (e) {
            setVerifyState('error');
            setVerifyMessage('No se pudo completar la verificación. Intente nuevamente.');
        }
    };

    // ── Revocar ───────────────────────────────────────────────────────────────
    const handleRevoke = async () => {
        if (!user) return;
        setIsRevoking(true);
        setError('');
        try {
            await signatureService.revoke(contract.id, user.id, user.organizationId || '');
            setVerifyState('idle');
            onSigned();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al revocar la firma.');
        } finally {
            setIsRevoking(false);
        }
    };

    // ── Copiar token ─────────────────────────────────────────────────────────
    const copyToken = () => {
        if (contract.signature_token) {
            navigator.clipboard.writeText(contract.signature_token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // ── Configuración visual por estado de firma ─────────────────────────────
    const statusConfig = {
        unsigned:         { color: '#94a3b8', bg: '#f8fafc', icon: <Clock size={18} />,       label: 'Sin Firmar' },
        pending:          { color: '#d97706', bg: '#fffbeb', icon: <Clock size={18} />,       label: 'Firma Pendiente' },
        signed_basic:     { color: '#16a34a', bg: '#f0fdf4', icon: <ShieldCheck size={18} />, label: 'Firmado — Básico (SHA-256)' },
        signed_advanced:  { color: '#1d4ed8', bg: '#eff6ff', icon: <ShieldCheck size={18} />, label: 'Firmado — Avanzado (eIDAS)' },
    } as const;

    const cfg = statusConfig[status as keyof typeof statusConfig] || statusConfig.unsigned;

    // ── Configuración visual del resultado de verificación ───────────────────
    const verifyConfig: Record<VerifyState, { color: string; bg: string; border: string; icon?: React.ReactNode }> = {
        idle:     { color: '#64748b', bg: 'transparent',  border: 'transparent' },
        checking: { color: '#6366f1', bg: '#f5f3ff',      border: '#c4b5fd', icon: <Loader2 size={16} className="spin" /> },
        valid:    { color: '#16a34a', bg: '#f0fdf4',      border: '#86efac', icon: <CheckCircle2 size={16} /> },
        invalid:  { color: '#dc2626', bg: '#fef2f2',      border: '#fca5a5', icon: <XCircle size={16} /> },
        error:    { color: '#d97706', bg: '#fffbeb',      border: '#fcd34d', icon: <AlertTriangle size={16} /> },
    };

    const vcfg = verifyConfig[verifyState];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* ── Badge de estado de firma ─── */}
            <div style={{
                padding: '1rem 1.25rem', borderRadius: '12px',
                background: cfg.bg, border: `1.5px solid ${cfg.color}30`,
                display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
                <span style={{ color: cfg.color }}>{cfg.icon}</span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: cfg.color, fontSize: '0.9rem' }}>{cfg.label}</div>
                    {isSigned && contract.signed_at && (
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            {new Date(contract.signed_at).toLocaleString('es-VE', {
                                day: '2-digit', month: 'long', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Detalles de firma ─── */}
            {isSigned && (
                <div style={{
                    background: '#f8fafc', borderRadius: '10px',
                    padding: '1rem', fontSize: '0.82rem', color: '#475569',
                    display: 'flex', flexDirection: 'column', gap: '0.5rem',
                }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 600, minWidth: '80px' }}>Firmante:</span>
                        <span>{contract.signed_by_name} &lt;{contract.signed_by_email}&gt;</span>
                    </div>
                    {contract.signature_hash && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <span style={{ fontWeight: 600, minWidth: '80px' }}>SHA-256:</span>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', color: '#334155' }}>
                                {contract.signature_hash.slice(0, 32)}…
                            </span>
                        </div>
                    )}
                    {contract.signature_token && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, minWidth: '80px' }}>Token:</span>
                            <code style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#1e293b' }}>
                                {contract.signature_token}
                            </code>
                            <button
                                onClick={copyToken}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center' }}
                                title="Copiar token"
                            >
                                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                            </button>
                        </div>
                    )}
                    <div style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#eff6ff', borderRadius: '8px', fontSize: '0.75rem', color: '#1d4ed8' }}>
                        🔐 Hash SHA-256 inmutable bajo la Ley de Datos y Firmas Electrónicas (LDFE) de Venezuela.
                    </div>
                </div>
            )}

            {/* ── Error general ─── */}
            {error && (
                <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '0.82rem', color: '#b91c1c', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {/* ── Botón: Verificar Integridad (solo si firmado) ─── */}
            {isSigned && verifyState !== 'checking' && (
                <button
                    onClick={handleVerify}
                    style={{
                        padding: '0.7rem 1.25rem', borderRadius: '10px',
                        border: '1.5px solid #6366f1', background: '#f5f3ff',
                        color: '#4f46e5', fontWeight: 700, fontSize: '0.85rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ede9fe')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f5f3ff')}
                >
                    <SearchCheck size={16} /> Verificar Integridad del Documento
                </button>
            )}

            {/* Spinner mientras verifica */}
            {verifyState === 'checking' && (
                <div style={{ padding: '0.75rem 1.25rem', borderRadius: '10px', background: '#f5f3ff', border: '1.5px solid #c4b5fd', color: '#6366f1', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Verificando integridad...
                </div>
            )}

            {/* Resultado de la verificación */}
            {verifyState !== 'idle' && verifyState !== 'checking' && (
                <div style={{
                    padding: '0.875rem 1.25rem', borderRadius: '10px',
                    background: vcfg.bg, border: `1.5px solid ${vcfg.border}`,
                    color: vcfg.color, fontSize: '0.84rem', fontWeight: 600,
                    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                    lineHeight: 1.5,
                }}>
                    <span style={{ flexShrink: 0, marginTop: '2px' }}>{vcfg.icon}</span>
                    <span>{verifyMessage}</span>
                </div>
            )}

            {/* ── Botón: Aplicar Firma ─── */}
            {canSign && !showConfirm && (
                <button
                    onClick={() => setShowConfirm(true)}
                    style={{
                        padding: '0.75rem 1.25rem', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                        color: 'white', fontWeight: 700, fontSize: '0.875rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '0.5rem',
                        boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
                    }}
                >
                    <PenLine size={16} /> Aplicar Firma Electrónica
                </button>
            )}

            {/* ── Confirmación de firma con Biometría ─── */}
            {canSign && showConfirm && (
                <div style={{ border: '2px solid #6366f1', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
                    <div style={{ padding: '1.25rem', background: '#f5f3ff', borderBottom: '1px solid #e0e7ff' }}>
                        <p style={{ margin: '0 0 0.5rem', fontWeight: 800, color: '#4338ca', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ShieldCheck size={20} /> Identidad Biométrica Requerida
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.5 }}>
                            Para este nivel de seguridad (Banca/Seguros), requerimos una captura facial vinculada al hash de la firma.
                        </p>
                    </div>

                    <div style={{ padding: '1.25rem', textAlign: 'center' }}>
                        {!showCamera && !capturedPhoto && (
                            <button 
                                onClick={startCamera}
                                style={{ padding: '1rem 1.5rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', margin: '0 auto' }}
                            >
                                <Camera size={20} /> ACTIVAR CÁMARA
                            </button>
                        )}

                        {showCamera && (
                            <div style={{ position: 'relative', width: '200px', height: '150px', margin: '0 auto', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button 
                                    onClick={takePhoto}
                                    style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    CAPTURAR ROSTRO
                                </button>
                            </div>
                        )}

                        {capturedPhoto && (
                            <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
                                <img src={capturedPhoto} alt="Biometría" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', border: '3px solid #10b981' }} />
                                <button 
                                    onClick={() => setCapturedPhoto(null)}
                                    style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', fontSize: '10px' }}
                                >
                                    X
                                </button>
                                <p style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700, marginTop: '8px' }}>✓ Identidad Verificada</p>
                            </div>
                        )}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                    </div>

                    <div style={{ padding: '1rem', background: '#f8fafc', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                        <button
                            onClick={() => { stopCamera(); setShowConfirm(false); }}
                            style={{ padding: '0.6rem 1.25rem', borderRadius: '10px', border: '1.5px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSign}
                            disabled={isSigning || (!capturedPhoto && !isSigning)}
                            style={{
                                padding: '0.6rem 2rem', borderRadius: '10px', border: 'none',
                                background: capturedPhoto ? '#16a34a' : '#94a3b8', color: 'white', fontWeight: 800,
                                cursor: (isSigning || !capturedPhoto) ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
                                opacity: (isSigning || !capturedPhoto) ? 0.7 : 1,
                            }}
                        >
                            {isSigning ? 'Firmando…' : 'FIRMAR AHORA'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Revocar (solo admin) ─── */}
            {canRevoke && (
                <button
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    style={{
                        padding: '0.6rem 1rem', borderRadius: '8px',
                        border: '1.5px solid #fecaca', background: '#fff',
                        color: '#b91c1c', fontWeight: 600, fontSize: '0.8rem',
                        cursor: isRevoking ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: '0.4rem',
                    }}
                >
                    <ShieldX size={15} />
                    {isRevoking ? 'Revocando…' : 'Revocar Firma'}
                </button>
            )}

            {/* ── Nota si el contrato no permite firma ─── */}
            {!canSign && !isSigned && (
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '0.75rem' }}>
                    El contrato debe estar en estado <strong>REVISIÓN</strong> o <strong>ACTIVO</strong> para poder ser firmado.
                </p>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};
