import React, { useEffect, useState, useRef } from 'react';
import { X, Bot, AlertTriangle, FileSignature, CheckCircle2, ExternalLink, Send, Loader2 } from 'lucide-react';
import { aiService, type AnalysisResult } from './ai.service.ts';
import { contractService } from '../contracts/contract.service.ts';
import { authService } from '../../core/auth.service.ts';
import type { Document } from './types.ts';

interface DocumentAnalysisModalProps {
    document: Document;
    onClose: () => void;
    /** Callback para navegar a Contratos después de registrar */
    onNavigateToContracts?: () => void;
}

type RegisterState = 'idle' | 'checking' | 'converting' | 'done' | 'already_exists';

const isLegacyOcrAnalysis = (result: AnalysisResult | null): boolean => {
    if (!result) return false;
    const summary = result.summary.toLowerCase();
    return (
        summary.includes('sistema ocr') ||
        summary.includes('extracción automatizada') ||
        summary.includes('no se dispone de detalles específicos') ||
        summary.includes('legaldoc ve')
    );
};

export const DocumentAnalysisModal: React.FC<DocumentAnalysisModalProps> = ({
    document,
    onClose,
    onNavigateToContracts,
}) => {
    const user = authService.getCurrentUser();

    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [showChat, setShowChat] = useState(false);
    const [registerState, setRegisterState] = useState<RegisterState>('idle');
    const [registeredContractId, setRegisteredContractId] = useState<string | null>(null);

    // Chat state
    type ChatMsg = { role: 'user' | 'assistant'; text: string };
    const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // ── Cargar análisis ──────────────────────────────────────────────────────
    const [ocrWorking, setOcrWorking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const fetchAnalysis = async () => {
        setLoading(true);
        setError(null);
        try {
            let result = await aiService.getLatestAnalysis(document.id);
            if (!result || isLegacyOcrAnalysis(result)) {
                // Paso 1: Extracción de contenido del documento
                setOcrWorking(true);
                const extractedText = await aiService.extractFullContent(document.id, document.type, document.title);
                setOcrWorking(false);
                
                // Paso 2: Análisis real con GPT-4o
                result = await aiService.analyze(
                    document.id,
                    extractedText,
                    document.type,
                    user?.organizationId || '',
                    user?.id || ''
                );
            }
            setAnalysis(result);

            // Verificar si ya tiene contrato vinculado al cargar
            const existingId = await contractService.findByDocumentId(document.id);
            if (existingId) {
                setRegisterState('already_exists');
                setRegisteredContractId(existingId);
            }
        } catch (err: any) {
            console.error('Error loading analysis', err);
            setError(err.message || 'Se produjo un error inesperado al analizar el documento.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalysis();
    }, [document]);

    // ── Registrar como contrato ──────────────────────────────────────────────
    const handleConvertToContract = async () => {
        if (!analysis) return;

        // 1. Anti-duplicado: verificar si ya existe
        setRegisterState('checking');
        const existingId = await contractService.findByDocumentId(document.id);
        if (existingId) {
            setRegisterState('already_exists');
            setRegisteredContractId(existingId);
            return;
        }

        // 2. Crear contrato
        setRegisterState('converting');
        try {
            const fullContent = await aiService.extractFullContent(document.id, document.type, document.title);
            const newId = contractService.generateId();

            await contractService.save({
                id: newId,
                title: document.title,
                type: 'OTHER',
                status: 'REVIEW',                   // siempre empieza en REVISIÓN
                parties: ['EMPRESA VE', 'CONTRAPARTE POR DEFINIR'],
                startDate: new Date().toISOString().split('T')[0],
                value: 0,
                currency: 'USD',
                assignedLawyerId: user?.id ?? '',
                assignedLawyerName: user?.name ?? user?.email ?? 'Sin asignar',
                description: analysis.summary,
                content_draft: fullContent,
                file_url: document.fileUrl,
                document_id: document.id,           // ← vínculo para anti-duplicado
                metadata: {
                    urgent: analysis.score < 50,
                    autoRenewal: false,
                    confidential: true,
                },
                organizationId: user?.organizationId,
            } as any);

            setRegisteredContractId(newId);
            setRegisterState('done');
        } catch (error) {
            console.error(error);
            setRegisterState('idle');
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#10b981';
        if (score >= 70) return '#f59e0b';
        return '#ef4444';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 90) return 'Excelente';
        if (score >= 70) return 'Aceptable';
        if (score >= 50) return 'Revisar';
        return 'Crítico';
    };

    // ── Botón de registro con estados visuales ───────────────────────────────
    const RegisterButton = () => {
        if (registerState === 'done' || registerState === 'already_exists') {
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{
                        padding: '0.875rem 1rem',
                        background: '#f0fdf4', border: '1px solid #86efac',
                        borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        color: '#15803d', fontSize: '0.85rem', fontWeight: 700,
                    }}>
                        <CheckCircle2 size={18} />
                        {registerState === 'done'
                            ? `Registrado: ${registeredContractId}`
                            : `Ya existe: ${registeredContractId}`}
                    </div>
                    {onNavigateToContracts && (
                        <button
                            onClick={() => { onClose(); onNavigateToContracts(); }}
                            style={{
                                width: '100%', padding: '0.75rem', background: '#fff',
                                border: '1px solid #22c55e', borderRadius: '12px',
                                color: '#15803d', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                fontSize: '0.85rem',
                            }}
                        >
                            <ExternalLink size={16} /> Ver en Contratos
                        </button>
                    )}
                </div>
            );
        }

        const isWorking = registerState === 'checking' || registerState === 'converting';
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button
                    onClick={handleConvertToContract}
                    disabled={isWorking}
                    style={{
                        width: '100%', padding: '1rem',
                        background: isWorking ? '#f1f5f9' : '#fefce8',
                        border: `1px solid ${isWorking ? '#e2e8f0' : '#fef08a'}`,
                        borderRadius: '12px', color: isWorking ? '#94a3b8' : '#854d0e',
                        fontWeight: 700, cursor: isWorking ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        transition: 'all 0.2s',
                    }}
                >
                    <FileSignature size={20} />
                    {registerState === 'checking' ? 'Verificando duplicados...'
                        : registerState === 'converting' ? 'Creando contrato...'
                        : '📌 Registrar como Contrato'}
                </button>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                    Crea un instrumento en <strong>Gestión Contractual</strong> en estado REVISIÓN,
                    vinculado a este documento. No modifica el documento original.
                </p>
            </div>
        );
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 120,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                width: '100%', maxWidth: '1000px', height: '90vh',
                display: 'flex', flexDirection: 'column',
                background: '#fff', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem 2rem',
                    background: 'linear-gradient(to right, #1e293b, #334155)',
                    color: '#fff', flexShrink: 0,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                            <Bot size={24} color="#60a5fa" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Análisis de IA Legal</h2>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>{document.title}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
                    {error ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '3rem', gap: '1.5rem', textAlign: 'center' }}>
                            <div style={{ padding: '20px', background: '#fef2f2', borderRadius: '50%' }}>
                                <AlertTriangle size={48} color="#ef4444" />
                            </div>
                            <div style={{ maxWidth: '400px' }}>
                                <h3 style={{ color: '#991b1b', fontWeight: 800, margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Error en Proceso IA</h3>
                                <p style={{ color: '#b91c1c', fontSize: '0.88rem', margin: 0, lineHeight: 1.6 }}>{error}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={fetchAnalysis}
                                    style={{ padding: '0.75rem 1.75rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Reintentar Análisis
                                </button>
                                <button
                                    onClick={onClose}
                                    style={{ padding: '0.75rem 1.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    ) : loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '1.5rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Bot size={64} color="#3b82f6" className={ocrWorking ? '' : 'animate-pulse'} />
                                {ocrWorking && (
                                    <div style={{ position: 'absolute', inset: -8, border: '3px solid #3b82f6', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                                )}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <h3 style={{ color: '#1e293b', fontWeight: 700, margin: '0 0 0.5rem' }}>
                                    {ocrWorking ? 'Extrayendo contenido del documento...' : 'Analizando riesgos legales...'}
                                </h3>
                                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                                    {ocrWorking ? 'Preparando contexto técnico para análisis jurídico' : 'Consultando motor GPT-4o con contexto venezolano'}
                                </p>
                            </div>
                        </div>
                    ) : analysis ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%' }}>

                            {/* Panel izquierdo: resultado análisis / chat */}
                            <div style={{ padding: '2.5rem', borderRight: '1px solid #e2e8f0', overflowY: 'auto' }}>
                                {!showChat ? (
                                    <>
                                        <div style={{ marginBottom: '2rem' }}>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>
                                                RESUMEN
                                            </h3>
                                            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', lineHeight: '1.7', color: '#334155' }}>
                                                {analysis?.summary || 'No se pudo generar un resumen del documento.'}
                                            </div>
                                        </div>

                                        <div>
                                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '1rem' }}>
                                                RIESGOS DETECTADOS
                                            </h3>
                                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                {(analysis?.risks || []).map((r, i) => (
                                                    <div key={i} style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                        <AlertTriangle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                        <span style={{ color: '#991b1b', fontSize: '0.9rem' }}>{r}</span>
                                                    </div>
                                                ))}
                                                {(!analysis?.risks || analysis.risks.length === 0) && (
                                                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No se han detectado riesgos específicos.</p>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    /* Panel de Chat IA */
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                                            🤖 Asistente Legal IA
                                        </h3>

                                        {/* Sugerencias iniciales */}
                                        {chatMessages.length === 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Preguntas frecuentes:</p>
                                                {[
                                                    '¿Cuáles son los riesgos de este documento?',
                                                    '¿Qué obligaciones tiene la empresa?',
                                                    '¿Qué sanciones aplican si no se cumple?',
                                                    '¿Cuáles son los plazos importantes?',
                                                ].map(q => (
                                                    <button key={q} onClick={() => { setChatInput(q); }} style={{
                                                        textAlign: 'left', padding: '0.45rem 0.75rem', borderRadius: '8px',
                                                        border: '1px solid #e2e8f0', background: '#f8fafc',
                                                        color: '#334155', fontSize: '0.78rem', cursor: 'pointer',
                                                        fontFamily: 'inherit',
                                                    }}>
                                                        💬 {q}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Historial de mensajes */}
                                        <div style={{
                                            flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column',
                                            gap: '0.75rem', padding: '0.5rem',
                                            background: chatMessages.length > 0 ? '#f8fafc' : 'transparent',
                                            borderRadius: '12px', minHeight: '120px',
                                        }}>
                                            {chatMessages.map((msg, i) => (
                                                <div key={i} style={{
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                                }}>
                                                    <div style={{
                                                        maxWidth: '90%', padding: '0.65rem 0.9rem',
                                                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                                        background: msg.role === 'user' ? '#3b82f6' : '#fff',
                                                        color: msg.role === 'user' ? '#fff' : '#1e293b',
                                                        fontSize: '0.83rem', lineHeight: 1.55,
                                                        border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                                                        whiteSpace: 'pre-wrap',
                                                    }}>
                                                        {/* Renderizado markdown básico */}
                                                        {msg.text.split('\n').map((line, li) => {
                                                            const boldLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
                                                            return <div key={li} dangerouslySetInnerHTML={{ __html: boldLine || '&nbsp;' }} />;
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                            {chatLoading && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6366f1', fontSize: '0.8rem' }}>
                                                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                    Analizando…
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>

                                        {/* Input */}
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <input
                                                value={chatInput}
                                                onChange={e => setChatInput(e.target.value)}
                                                onKeyDown={async e => {
                                                    if (e.key === 'Enter' && !e.shiftKey && chatInput.trim() && !chatLoading && analysis) {
                                                        e.preventDefault();
                                                        const q = chatInput.trim();
                                                        setChatInput('');
                                                        setChatMessages(prev => [...prev, { role: 'user', text: q }]);
                                                        setChatLoading(true);
                                                        try {
                                                            const answer = await aiService.chatQuery(q, document.title, document.type, analysis);
                                                            setChatMessages(prev => [...prev, { role: 'assistant', text: answer }]);
                                                        } finally {
                                                            setChatLoading(false);
                                                            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                                                        }
                                                    }
                                                }}
                                                placeholder="Ej: ¿Qué obligaciones tiene la empresa?"
                                                disabled={chatLoading}
                                                style={{
                                                    flex: 1, padding: '0.7rem 0.9rem', borderRadius: '10px',
                                                    border: '1.5px solid #e2e8f0', fontSize: '0.85rem',
                                                    outline: 'none', fontFamily: 'inherit',
                                                    background: chatLoading ? '#f8fafc' : '#fff',
                                                }}
                                            />
                                            <button
                                                disabled={!chatInput.trim() || chatLoading || !analysis}
                                                onClick={async () => {
                                                    if (!chatInput.trim() || chatLoading || !analysis) return;
                                                    const q = chatInput.trim();
                                                    setChatInput('');
                                                    setChatMessages(prev => [...prev, { role: 'user', text: q }]);
                                                    setChatLoading(true);
                                                    try {
                                                        const answer = await aiService.chatQuery(q, document.title, document.type, analysis);
                                                        setChatMessages(prev => [...prev, { role: 'assistant', text: answer }]);
                                                    } finally {
                                                        setChatLoading(false);
                                                        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                                                    }
                                                }}
                                                style={{
                                                    padding: '0.7rem 1rem', borderRadius: '10px', border: 'none',
                                                    background: (!chatInput.trim() || chatLoading) ? '#e2e8f0' : '#3b82f6',
                                                    color: (!chatInput.trim() || chatLoading) ? '#94a3b8' : 'white',
                                                    fontWeight: 700, cursor: (!chatInput.trim() || chatLoading) ? 'not-allowed' : 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s',
                                                }}
                                            >
                                                <Send size={15} /> Enviar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Panel derecho: score + acciones */}
                            <div style={{ background: '#f8fafc', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
                                {/* Score */}
                                <div style={{ textAlign: 'center', background: '#fff', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
                                    <div style={{ fontSize: '3rem', fontWeight: 900, color: getScoreColor(analysis?.score || 0), lineHeight: 1 }}>
                                        {analysis?.score || 0}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Score de Cumplimiento</div>
                                    <div style={{ marginTop: '0.5rem', padding: '4px 12px', borderRadius: '8px', background: getScoreColor(analysis?.score || 0) + '15', color: getScoreColor(analysis?.score || 0), fontSize: '0.78rem', fontWeight: 800, display: 'inline-block' }}>
                                        {getScoreLabel(analysis?.score || 0)}
                                    </div>
                                </div>

                                {/* Información del documento */}
                                <div style={{ background: '#fff', borderRadius: '12px', padding: '1rem', border: '1px solid #e2e8f0', fontSize: '0.8rem' }}>
                                    <div style={{ fontWeight: 800, color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Documento analizado</div>
                                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>{document?.title || 'Documento sin título'}</div>
                                    <div style={{ color: '#94a3b8' }}>Tipo: {document?.type || 'N/A'}</div>
                                </div>

                                {/* Acciones */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
                                    <RegisterButton />

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                        <button
                                            onClick={() => setShowChat(!showChat)}
                                            style={{
                                                width: '100%', padding: '0.875rem',
                                                background: showChat ? '#eff6ff' : '#fff',
                                                border: `1px solid ${showChat ? '#93c5fd' : '#e2e8f0'}`,
                                                borderRadius: '12px', fontWeight: 600, cursor: 'pointer',
                                                color: showChat ? '#1d4ed8' : '#334155',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {showChat ? '← Ver Análisis' : '🤖 Preguntar a IA'}
                                        </button>
                                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', lineHeight: 1.4 }}>
                                            Consulta sobre cláusulas, obligaciones o riesgos específicos de este documento.
                                        </p>
                                    </div>

                                    <button
                                        onClick={onClose}
                                        style={{
                                            width: '100%', padding: '0.875rem',
                                            background: '#3b82f6', color: '#fff',
                                            border: 'none', borderRadius: '12px',
                                            fontWeight: 700, cursor: 'pointer',
                                        }}
                                    >
                                        Listo
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
    );
};
