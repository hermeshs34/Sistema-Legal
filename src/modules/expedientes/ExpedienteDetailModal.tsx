import React, { useState, useEffect } from 'react';
import {
    X, Edit, Plus, Calendar, FileText, Printer,
    Trash2, Save, Zap, TrendingUp, AlertOctagon, RefreshCw, BarChart3, Info, Loader2,
    FileCheck, Archive, Shield, Clock, Target, AlertTriangle, CheckCircle, Paperclip
} from 'lucide-react';
import { predictiveAiService, type JudicialPrediction } from '../shared/predictive-ai.service.ts';
import { expedienteService } from './expediente.service.ts';
import { reportService } from '../shared/report.service.ts';
import { authService } from '../../core/auth.service.ts';
import { LapsosWidget } from '../calendar/LapsosWidget.tsx';
import { FlowWidget } from '../flows/FlowWidget.tsx';
import { ActuacionesTimeline } from './ActuacionesTimeline.tsx';
import type { Expediente, Actuacion, Audiencia, TipoActuacion, TipoAudiencia, AudienciaStatus, ActuacionStatus } from './types.ts';
import { STATUS_CONFIG, RIESGO_CONFIG, TIPO_PROCESO_LABELS, TIPO_ACTUACION_LABELS } from './types.ts';

interface Props {
    expediente: Expediente;
    onClose: () => void;
    onEdit: () => void;
    onRefresh: () => void;
}

const sectionTitle = (text: string) => (
    <h4 style={{ margin: '0 0 1.25rem', fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '4px', height: '14px', background: '#6366f1', borderRadius: '4px' }} />
        {text}
    </h4>
);

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.75rem 1rem', borderRadius: '12px',
    border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#1e293b',
    background: '#f8fafc', outline: 'none', boxSizing: 'border-box',
    transition: 'all 0.2s',
};

export const ExpedienteDetailModal: React.FC<Props> = ({ expediente: initialExp, onClose, onEdit, onRefresh }) => {
    const user = authService.getCurrentUser();
    const [tab, setTab] = useState<'info' | 'actuaciones' | 'audiencias' | 'lapsos' | 'flow' | 'predictive'>('info');
    const [prediction, setPrediction] = useState<JudicialPrediction | null>(null);
    const [loadingPrediction, setLoadingPrediction] = useState(false);
    const [actuaciones, setActuaciones] = useState<Actuacion[]>([]);
    const [audiencias, setAudiencias] = useState<Audiencia[]>([]);
    
    // Estados para correcciones
    const [editingActId, setEditingActId] = useState<string | null>(null);
    const [editingAudId, setEditingAudId] = useState<string | null>(null);
    const [confirmBeforeSave, setConfirmBeforeSave] = useState(false);

    // Formulario actuación
    const [showActForm, setShowActForm] = useState(false);
    const [actForm, setActForm] = useState({ 
        fecha: new Date().toISOString().split('T')[0], 
        tipo: 'DILIGENCIA' as TipoActuacion, 
        descripcion: '', 
        resultado: '', 
        proximoPaso: '',
        status: 'REALIZADA' as ActuacionStatus,
        archivoUrl: '' as string | undefined
    });
    const [actFile, setActFile] = useState<File | null>(null);
    const [savingAct, setSavingAct] = useState(false);

    // Formulario audiencia
    const [showAudForm, setShowAudForm] = useState(false);
    const [audForm, setAudForm] = useState({ fechaHora: new Date().toISOString(), tipo: 'ORDINARIA' as TipoAudiencia, descripcion: '', status: 'PENDIENTE' as AudienciaStatus });
    const [savingAud, setSavingAud] = useState(false);

    const isAuthorizedToRevert = user?.role === 'consultor_general';

    const stCfg = STATUS_CONFIG[initialExp.status];
    const rCfg = RIESGO_CONFIG[initialExp.riesgo];

    const loadSubs = async () => {
        const [acts, auds] = await Promise.all([
            expedienteService.getActuaciones(initialExp.id),
            expedienteService.getAudiencias(initialExp.id),
        ]);
        setActuaciones(acts);
        setAudiencias(auds);
    };

    useEffect(() => {
        if (tab === 'actuaciones' || tab === 'audiencias') loadSubs();
        if (tab === 'predictive' && !prediction) handlePredict();
    }, [tab]);

    const handlePredict = async () => {
        setLoadingPrediction(true);
        try {
            const [acts, auds] = await Promise.all([
                expedienteService.getActuaciones(initialExp.id),
                expedienteService.getAudiencias(initialExp.id)
            ]);
            const res = await predictiveAiService.analyzeExpedienteRisk(initialExp, acts, auds);
            setPrediction(res);
        } catch (err) {
            console.error('Prediction error:', err);
        } finally {
            setLoadingPrediction(false);
        }
    };

    const handleSaveActuacion = async () => {
        if (!actForm.descripcion.trim()) return;
        if (!confirmBeforeSave) {
            setConfirmBeforeSave(true);
            return;
        }
        setSavingAct(true);
        try {
            let finalArchivoUrl = actForm.archivoUrl;
            if (actFile) {
                finalArchivoUrl = await expedienteService.uploadActuacionFile(initialExp.id, actFile);
            }

            if (editingActId) {
                await expedienteService.updateActuacion(editingActId, { ...actForm, archivoUrl: finalArchivoUrl });
            } else {
                await expedienteService.saveActuacion({
                    expedienteId: initialExp.id,
                    organizationId: initialExp.organizationId,
                    ...actForm,
                    archivoUrl: finalArchivoUrl,
                    createdBy: user?.id,
                });
            }
            setActForm({ 
                fecha: new Date().toISOString().split('T')[0], 
                tipo: 'DILIGENCIA', 
                descripcion: '', 
                resultado: '', 
                proximoPaso: '', 
                status: 'REALIZADA',
                archivoUrl: undefined
            });
            setActFile(null);
            setShowActForm(false);
            setEditingActId(null);
            setConfirmBeforeSave(false);
            await loadSubs();
        } finally {
            setSavingAct(false);
        }
    };

    const handleSaveAudiencia = async () => {
        if (!audForm.descripcion.trim()) return;
        if (!confirmBeforeSave) {
            setConfirmBeforeSave(true);
            return;
        }
        setSavingAud(true);
        try {
            if (editingAudId) {
                await expedienteService.updateAudiencia(editingAudId, { ...audForm });
            } else {
                await expedienteService.saveAudiencia({
                    expedienteId: initialExp.id,
                    organizationId: initialExp.organizationId,
                    diasAlerta: 3,
                    ...audForm,
                });
            }
            setShowAudForm(false);
            setEditingAudId(null);
            setConfirmBeforeSave(false);
            await loadSubs();
        } finally {
            setSavingAud(false);
        }
    };

    const tabBtn = (id: typeof tab, label: string, icon: React.ReactNode) => (
        <button key={id} onClick={() => setTab(id)} style={{
            padding: '0.85rem 1.75rem', border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: tab === id ? '#4f46e5' : '#64748b',
            fontWeight: tab === id ? 800 : 600, fontSize: '0.85rem',
            borderBottom: tab === id ? '3px solid #6366f1' : '3px solid transparent',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '8px'
        }}>
            {icon} {label}
        </button>
    );

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <div style={{ background: '#fff', borderRadius: '32px', width: '100%', maxWidth: '1100px', height: '94vh', display: 'flex', flexDirection: 'column', boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5)', overflow: 'hidden', animation: 'modalZoomUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>

                {/* Header Premium (Fondo Azul/Morado de Imagen 2) */}
                <div style={{ padding: '2.5rem 3rem', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: 'white', flexShrink: 0, position: 'relative' }}>
                    
                    {/* Top Bar info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#a5b4fc', letterSpacing: '0.1em' }}>EXP #{initialExp.id}</span>
                            <span style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 900, background: stCfg.bg, color: stCfg.color, textTransform: 'uppercase' }}>{stCfg.label} ⚡</span>
                            <span style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Zap size={10} fill="#10b981" /> BAJO
                            </span>
                            <span style={{ padding: '4px 12px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 800, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                                👤 {initialExp.tipoProceso}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            <button onClick={() => reportService.generateDossierProcesal(initialExp)} style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Printer size={14} /> Dossier
                            </button>
                            <button onClick={() => reportService.generateActaAudiencia(initialExp)} style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileCheck size={14} /> Acta
                            </button>
                            <button onClick={() => { if(window.confirm('¿Desea generar el Informe de Cierre Definitivo de este expediente?')) reportService.generateCierreCaso(initialExp); }} style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', background: '#991b1b', color: 'white', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Archive size={14} /> Cierre
                            </button>
                            <button onClick={onEdit} style={{ padding: '0.6rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Edit size={14} /> Editar
                            </button>
                            <button onClick={onClose} style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    <h2 style={{ margin: '0 0 0.75rem', fontSize: '2.1rem', fontWeight: 900, lineHeight: 1.1, maxWidth: '90%', color: '#ffffff', textShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
                        {initialExp.titulo}
                    </h2>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', opacity: 0.9 }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>⚔️ {initialExp.parteActora} <span style={{ opacity: 0.6 }}>vs</span> {initialExp.parteDemandada}</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>🏛️ {initialExp.tribunal || 'Tribunal No Asignado'}</span>
                        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>📄 {initialExp.numeroExpediente || 'S/N'}</span>
                    </div>

                    {/* Summary Bar Floating (Imagen 2) */}
                    <div style={{ position: 'absolute', bottom: '-26px', left: '3rem', right: '3rem', height: '52px', background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', borderRadius: '16px', display: 'flex', padding: '0 2rem', alignItems: 'center', gap: '2.5rem', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>💰</div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>Cuantía: <strong style={{ color: '#fff' }}>{initialExp.currency} {initialExp.cuantia?.toLocaleString()}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>📅</div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>Inicio: <strong style={{ color: '#fff' }}>{initialExp.fechaInicio ? new Date(initialExp.fechaInicio).toLocaleDateString() : '—'}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#a855f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🏗️</div>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>Posición: <strong style={{ color: '#fff' }}>{initialExp.nuestraPosicion}</strong></span>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation (Stylo Premium) */}
                <div style={{ padding: '1.25rem 3rem 0', background: '#fff', display: 'flex', borderBottom: '1px solid #f1f5f9', marginTop: '1.5rem', flexShrink: 0 }}>
                    {tabBtn('info', 'Información', <FileText size={16} />)}
                    {tabBtn('actuaciones', 'Actuaciones', <Edit size={16} />)}
                    {tabBtn('audiencias', 'Audiencias', <Calendar size={16} />)}
                    {tabBtn('lapsos', 'Lapsos', <Clock size={16} />)}
                    {tabBtn('flow', 'Flujo', <BarChart3 size={16} />)}
                    {tabBtn('predictive', 'IA Predictiva', <Zap size={16} />)}
                </div>

                {/* Main Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem 3rem', background: '#fff' }}>
                    
                    {tab === 'info' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem' }}>
                            <div>
                                {sectionTitle('🏢 Partes y Jurisdicción')}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div><label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>DEMANDANTE / ACTOR</label><p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{initialExp.parteActora}</p></div>
                                    <div><label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>DEMANDADO</label><p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{initialExp.parteDemandada}</p></div>
                                    <div><label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>TRIBUNAL DESIGNADO</label><p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{initialExp.tribunal || 'Por definir'}</p></div>
                                </div>
                            </div>
                            <div>
                                {sectionTitle('⚖️ Clasificación Legal')}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                    <div><label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>TIPO DE PROCESO</label><p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{TIPO_PROCESO_LABELS[initialExp.tipoProceso]}</p></div>
                                    <div><label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>MATERIA / ÁREA</label><p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{initialExp.materia}</p></div>
                                    <div><label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>REGIÓN / JURISDICCIÓN</label><p style={{ margin: '4px 0 0', fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>{initialExp.region}</p></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'actuaciones' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                {sectionTitle(`ACTUACIONES PROCESALES (${actuaciones.length})`)}
                                <button onClick={() => { setEditingActId(null); setConfirmBeforeSave(false); setShowActForm(true); }} style={{ padding: '0.65rem 1.5rem', borderRadius: '12px', background: '#6366f1', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
                                    <Plus size={16} /> Nueva Actuación
                                </button>
                            </div>

                            {showActForm && (
                                <div style={{ background: '#f8fafc', padding: '1.75rem', borderRadius: '24px', border: '1.5px solid #e2e8f0', marginBottom: '2.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
                                    <h5 style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{editingActId ? 'CORREGIR ACTUACIÓN' : 'REGISTRAR HITO PROCESAL'}</h5>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>FECHA DE ACTUACIÓN</label>
                                            <input type="date" style={inputStyle} value={actForm.fecha} onChange={e => setActForm({ ...actForm, fecha: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>TIPO</label>
                                            <select style={inputStyle} value={actForm.tipo} onChange={e => setActForm({ ...actForm, tipo: e.target.value as TipoActuacion })}>
                                                {Object.entries(TIPO_ACTUACION_LABELS).map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>ESTADO</label>
                                            <select style={inputStyle} value={actForm.status} onChange={e => setActForm({ ...actForm, status: e.target.value as ActuacionStatus })}>
                                                <option value="PENDIENTE">⏳ Pendiente</option>
                                                <option value="REALIZADA">✅ Realizada</option>
                                                <option value="SUSPENDIDA">❌ Suspendida</option>
                                                <option value="DIFERIDA">🔁 Diferida</option>
                                            </select>
                                        </div>
                                    </div>

                                    <textarea style={{ ...inputStyle, minHeight: '100px', marginBottom: '1.25rem' }} value={actForm.descripcion} onChange={e => setActForm({ ...actForm, descripcion: e.target.value })} placeholder="Escriba la descripción oficial de la actuación..." />
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>RESULTADO INMEDIATO / IMPACTO</label>
                                            <input type="text" style={inputStyle} value={actForm.resultado} onChange={e => setActForm({ ...actForm, resultado: e.target.value })} placeholder="¿Qué se logró?" />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>PRÓXIMO PASO SUGERIDO</label>
                                            <input type="text" style={inputStyle} value={actForm.proximoPaso} onChange={e => setActForm({ ...actForm, proximoPaso: e.target.value })} placeholder="Acción a seguir..." />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94a3b8', marginBottom: '8px', display: 'block' }}>DOCUMENTO DE RESPALDO (ESCANEADO / PDF)</label>
                                        <div style={{ position: 'relative', height: '48px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', paddingLeft: '1rem', paddingRight: '1rem', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                            <Paperclip size={16} style={{ position: 'absolute', left: '1rem', color: '#64748b' }} />
                                            <input 
                                                type="file" 
                                                onChange={e => setActFile(e.target.files?.[0] || null)}
                                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                                            />
                                            <span style={{ marginLeft: '3rem', fontSize: '0.85rem', color: actFile ? '#1e293b' : '#94a3b8', fontWeight: actFile ? 700 : 400 }}>
                                                {actFile ? `✅ ${actFile.name}` : (actForm.archivoUrl ? '📄 Archivo cargado (Clic para cambiar)' : 'Adjuntar acta o boleta de diligencia...')}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
                                        {confirmBeforeSave && <span style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}><AlertOctagon size={14} /> ¿La información es veraz y corregida?</span>}
                                        <button onClick={() => setShowActForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Cancelar</button>
                                        <button onClick={handleSaveActuacion} disabled={savingAct} style={{ padding: '0.75rem 2rem', borderRadius: '12px', background: confirmBeforeSave ? '#e11d48' : '#1e1b4b', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {savingAct && <RefreshCw size={16} className="spin" />}
                                            {savingAct ? 'GUARDANDO...' : (confirmBeforeSave ? 'SÍ, CONFIRMO' : 'Guardar Actuación')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <ActuacionesTimeline 
                                actuaciones={actuaciones}
                                onEdit={(act) => {
                                    setEditingActId(act.id);
                                    setActForm({
                                        fecha: act.fecha,
                                        tipo: act.tipo,
                                        descripcion: act.descripcion,
                                        resultado: act.resultado || '',
                                        proximoPaso: act.proximoPaso || '',
                                        status: act.status || 'REALIZADA',
                                        archivoUrl: act.archivoUrl
                                    });
                                    setShowActForm(true);
                                }}
                                onDelete={(id) => {
                                    if(window.confirm('¿Desea revertir este hito procesal?')) 
                                        expedienteService.deleteActuacion(id).then(loadSubs);
                                }}
                                canDelete={isAuthorizedToRevert}
                            />
                        </div>
                    )}

                    {tab === 'audiencias' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                {sectionTitle(`AUDIENCIAS PROGRAMADAS (${audiencias.length})`)}
                                <button onClick={() => { setEditingAudId(null); setConfirmBeforeSave(false); setShowAudForm(true); }} style={{ padding: '0.65rem 1.5rem', borderRadius: '12px', background: '#6366f1', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
                                    <Plus size={16} /> Programar Audiencia
                                </button>
                            </div>

                            {showAudForm && (
                                <div style={{ background: '#f8fafc', padding: '1.75rem', borderRadius: '24px', border: '1.5px solid #e2e8f0', marginBottom: '2.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
                                    <h5 style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{editingAudId ? 'CORREGIR AUDIENCIA' : 'PROGRAMAR NUEVA AUDIENCIA'}</h5>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                        <input type="datetime-local" style={inputStyle} value={audForm.fechaHora.slice(0, 16)} onChange={e => setAudForm({ ...audForm, fechaHora: e.target.value })} />
                                        <select style={inputStyle} value={audForm.status} onChange={e => setAudForm({ ...audForm, status: e.target.value as AudienciaStatus })}>
                                            <option value="PENDIENTE">⏳ Pendiente</option>
                                            <option value="REALIZADA">✅ Realizada</option>
                                            <option value="SUSPENDIDA">❌ Suspendida</option>
                                            <option value="DIFERIDA">🔁 Diferida</option>
                                        </select>
                                    </div>
                                    <textarea style={{ ...inputStyle, minHeight: '80px', marginBottom: '1.25rem' }} value={audForm.descripcion} onChange={e => setAudForm({ ...audForm, descripcion: e.target.value })} placeholder="Descripción de la audiencia..." />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', alignItems: 'center' }}>
                                        {confirmBeforeSave && <span style={{ fontSize: '0.75rem', color: '#e11d48', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '6px' }}><AlertOctagon size={14} /> ¿Confirmas la corrección de la audiencia?</span>}
                                        <button onClick={() => setShowAudForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>Cancelar</button>
                                        <button onClick={handleSaveAudiencia} style={{ padding: '0.75rem 2rem', borderRadius: '12px', background: confirmBeforeSave ? '#e11d48' : '#1e1b4b', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', fontSize: '0.9rem' }}>
                                            {confirmBeforeSave ? 'SÍ, CONFIRMO' : 'Guardar'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {audiencias.map(aud => (
                                    <div key={aud.id} style={{ padding: '1.5rem 1.75rem', background: '#fff', borderRadius: '20px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>{new Date(aud.fechaHora).toLocaleString('es-VE')}</span>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '6px' }}>{aud.tipo}</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>{aud.descripcion}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => { 
                                                setEditingAudId(aud.id); 
                                                setAudForm({ 
                                                    fechaHora: aud.fechaHora,
                                                    tipo: aud.tipo,
                                                    descripcion: aud.descripcion || '',
                                                    status: aud.status
                                                }); 
                                                setShowAudForm(true); 
                                            }} style={{ padding: '0.5rem', color: '#6366f1', background: '#f5f3ff', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Edit size={16} /></button>
                                            {isAuthorizedToRevert && <button onClick={() => { if(window.confirm('¿Desea eliminar esta audiencia?')) expedienteService.deleteAudiencia(aud.id).then(loadSubs); }} style={{ padding: '0.5rem', color: '#ef4444', background: '#fef2f2', borderRadius: '10px', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {tab === 'lapsos' && <LapsosWidget expedienteId={initialExp.id} fechaInicio={initialExp.fechaInicio!} processType={initialExp.tipoProceso as any} jurisdiction={initialExp.region} />}
                    {tab === 'flow' && (
                        <FlowWidget 
                            expedienteId={initialExp.id} 
                            organizationId={initialExp.organizationId} 
                            processType={initialExp.tipoProceso as any} 
                            onSyncActuacion={(name, date) => {
                                setTab('actuaciones');
                                setActForm(prev => ({ 
                                    ...prev, 
                                    fecha: date, 
                                    descripcion: `Hito consolidado: ${name}`, 
                                    status: 'REALIZADA' 
                                }));
                                setShowActForm(true);
                            }}
                        />
                    )}
                    
                    {tab === 'predictive' && (
                        <div style={{ padding: '2.5rem' }}>
                            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'linear-gradient(135deg, #f59e0b20, #f59e0b10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', border: '1px solid #f59e0b30' }}>
                                    <Zap size={38} color="#f59e0b" fill="#f59e0b20" />
                                </div>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b', marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>Consultoría de Inteligencia LegalDoc</h3>
                                <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 2rem' }}>Nuestro motor de IA analiza a fondo el historial de actuaciones, la cuantía y el contexto procesal para proyectar escenarios de éxito y mitigación de riesgos.</p>
                                
                                <button 
                                    onClick={handlePredict} 
                                    disabled={loadingPrediction} 
                                    style={{ padding: '1rem 3rem', borderRadius: '16px', background: '#0f172a', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '12px', fontSize: '1.05rem', boxShadow: '0 10px 25px rgba(15,23,42,0.2)', transition: 'all 0.2s' }}
                                >
                                    {loadingPrediction ? <RefreshCw className="spin" size={20} /> : <Target size={20} />} 
                                    {loadingPrediction ? 'EJECUTANDO RAZONAMIENTO JURÍDICO...' : 'CALCULAR PROYECCIÓN ESTRATÉGICA'}
                                </button>
                            </div>

                            {prediction && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', animation: 'modalZoomUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                                    {/* Panel Principal Probabilidad */}
                                    <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: '32px', padding: '3rem', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}><Target size={180} /></div>
                                        <span style={{ fontSize: '5rem', fontWeight: 900, color: '#fff', textShadow: '0 10px 20px rgba(0,0,0,0.3)', lineHeight: 1 }}>{prediction.probability}%</span>
                                        <p style={{ fontWeight: 900, color: '#a5b4fc', letterSpacing: '3px', marginTop: '1rem', fontSize: '0.85rem' }}>PROBABILIDAD DE ÉXITO</p>
                                        <div style={{ marginTop: '2.5rem', padding: '0.6rem 1.5rem', borderRadius: '12px', background: prediction.riskLevel === 'BAJO' ? '#059669' : prediction.riskLevel === 'MEDIO' ? '#d97706' : '#dc2626', color: 'white', fontSize: '0.9rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertTriangle size={16} /> RIESGO {prediction.riskLevel}
                                        </div>
                                    </div>

                                    {/* Panel de Detalles */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div style={{ background: '#f8fafc', padding: '1.75rem', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                            <h5 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16} color="#6366f1" /> FACTORES DETERMINANTES</h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {prediction.keyFactors.map((f, i) => (
                                                    <div key={i} style={{ fontSize: '0.88rem', color: '#475569', display: 'flex', gap: '10px' }}>
                                                        <span style={{ color: '#6366f1', fontWeight: 900 }}>•</span> {f}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ background: '#fffbeb', padding: '1.75rem', borderRadius: '24px', border: '1px solid #fde68a' }}>
                                            <h5 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 900, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={16} color="#d97706" /> RECOMENDACIONES ESTRATÉGICAS</h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {prediction.recommendations.map((r, i) => (
                                                    <div key={i} style={{ fontSize: '0.88rem', color: '#92400e', fontWeight: 600, display: 'flex', gap: '10px' }}>
                                                        <CheckCircle size={14} style={{ marginTop: '3px', flexShrink: 0 }} /> {r}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resumen Ejecutivo */}
                                    <div style={{ gridColumn: 'span 2', background: '#fff', padding: '2rem', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
                                        <h5 style={{ margin: '0 0 1rem', fontSize: '0.85rem', fontWeight: 900, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} color="#475569" /> RESUMEN EJECUTIVO PARA LA CONSULTORÍA GENERAL</h5>
                                        <p style={{ margin: 0, color: '#334155', fontSize: '0.98rem', lineHeight: 1.7, fontWeight: 500 }}>{prediction.summary}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Identitario (Imagen 2) */}
                <div style={{ padding: '1.25rem 3rem', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                        LegalTech Compliance VE © 2026 &nbsp;·&nbsp; {initialExp.titulo}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6366f1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={14} /> INTEGRIDAD SHA-256 GARANTIZADA
                    </span>
                </div>
            </div>
            
            <style>{`
                @keyframes modalZoomUp { 
                    from { transform: scale(0.9) translateY(40px); opacity: 0; } 
                    to { transform: scale(1) translateY(0); opacity: 1; } 
                }
                .spin { animation: spin 2s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: #f8fafc; }
                ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
            `}</style>
        </div>
    );
};
