import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Info, AlertTriangle, Calendar, Briefcase, FileText, Activity, Brain, Loader2 } from 'lucide-react';
import { aiService } from '../documents/ai.service.ts';
import type { ComplianceItem, ComplianceStatus, RiskArea, RiskLevel } from './types.ts';
import { complianceService } from './compliance.service.ts';

interface ComplianceFormProps {
    initialData?: ComplianceItem;
    onClose: () => void;
    onSave: () => void;
}

export const ComplianceForm: React.FC<ComplianceFormProps> = ({ initialData, onClose, onSave }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<ComplianceItem>>({
        title: '',
        area: 'LEGAL',
        description: '',
        status: 'PENDING',
        riskLevel: 'LOW',
        lastAssessment: new Date().toISOString().split('T')[0],
        nextReview: new Date().toISOString().split('T')[0],
        observations: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (field: keyof ComplianceItem, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAiAnalysis = async () => {
        if (!formData.description) {
            alert('Por favor ingrese una descripción para analizar');
            return;
        }

        setIsAnalyzing(true);
        try {
            const analysis = await aiService.analyzeComplianceRisk(formData.description);
            setFormData(prev => ({
                ...prev,
                riskLevel: analysis.suggestedLevel,
                legalCitation: analysis.legalCitation,
                observations: (prev.observations ? prev.observations + '\n\n' : '') + 
                    `[IA FUNDAMENTO LEGAL]: ${analysis.legalCitation || 'Normativa general'}\n[IA INSIGHT]: ${analysis.reasoning}`,
                nextReview: analysis.suggestedNextReview
            }));
            setAiInsight(analysis.reasoning);
        } catch (error) {
            console.error(error);
            alert('Error en el análisis de IA');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.description) return;

        const itemToSave = {
            ...formData,
            id: initialData?.id,
        } as ComplianceItem;

        try {
            await complianceService.save(itemToSave);
            onSave();
        } catch (error) {
            console.error('Error saving compliance item:', error);
            alert('Error al guardar la evaluación de cumplimiento');
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 110,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div className="premium-card" style={{
                width: '100%', maxWidth: '850px', maxHeight: '92vh',
                display: 'flex', flexDirection: 'column',
                padding: 0, borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
                background: '#fff',
                animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                <div style={{
                    padding: '2rem 2.5rem',
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
                    color: '#fff',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <button onClick={onClose} style={{
                        position: 'absolute', top: '1.5rem', right: '1.5rem',
                        border: 'none', background: 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '50%', color: '#fff', padding: '10px',
                        cursor: 'pointer', transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <X size={20} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                        <div style={{
                            padding: '1rem',
                            background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.3)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                        }}>
                            <Shield size={32} strokeWidth={2} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
                                {initialData ? 'Actualizar Evaluación' : 'Nueva Evaluación de Cumplimiento'}
                            </h2>
                            <p style={{ fontSize: '0.95rem', margin: '6px 0 0 0', opacity: 0.9, fontWeight: 500 }}>
                                {initialData ? `Modificando: ${initialData.id}` : 'Defina un nuevo punto de control legislativo'}
                            </p>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', background: 'linear-gradient(to bottom, #fafbfc 0%, #fff 100%)' }}>
                    <form id="compliance-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '2rem' }}>
                        <div style={{ padding: '2rem', background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #f1f5f9' }}>
                                <div style={{ padding: '8px', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', borderRadius: '12px', color: '#fff' }}>
                                    <FileText size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Identificación del Requisito</h3>
                            </div>

                            <div style={{ display: 'grid', gap: '1.5rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Título del Requisito <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input type="text" required className="form-input" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0' }} value={formData.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="Ej. Solvencia Laboral INCES Q4-2024" />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}><Briefcase size={14} /> Área de Riesgo</label>
                                        <select className="form-input" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0' }} value={formData.area} onChange={(e) => handleChange('area', e.target.value as RiskArea)}>
                                            <option value="LEGAL">⚖️ Legal / Corporativo</option>
                                            <option value="TAX">💰 Tributario / Fiscal</option>
                                            <option value="LABOR">👔 Laboral</option>
                                            <option value="REGULATORY">📋 Regulatorio</option>
                                            <option value="ENVIRONMENTAL">🌱 Ambiental</option>
                                            <option value="OPERATIONAL">⚙️ Operacional</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}><AlertTriangle size={14} /> Nivel de Riesgo</label>
                                        <select className="form-input" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0' }} value={formData.riskLevel} onChange={(e) => handleChange('riskLevel', e.target.value as RiskLevel)}>
                                            <option value="LOW">🟢 Bajo</option>
                                            <option value="MEDIUM">🟡 Medio</option>
                                            <option value="HIGH">🟠 Alto</option>
                                            <option value="CRITICAL">🔴 Crítico</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Descripción del Punto de Control <span style={{ color: '#ef4444' }}>*</span></label>
                                        <input type="text" required className="form-input" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0' }} value={formData.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Defina brevemente el requisito normativo..." />
                                    </div>
                                    <button type="button" onClick={handleAiAnalysis} disabled={isAnalyzing} style={{ padding: '0.875rem 1.25rem', background: '#f5f3ff', color: '#7c3aed', border: '2px solid #ddd6fe', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <Brain size={18} />}
                                        Análisis IA
                                    </button>
                                </div>
                                {aiInsight && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {formData.legalCitation && (
                                            <div style={{ 
                                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                                padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%)',
                                                border: '1px solid #d946ef', borderRadius: '100px',
                                                color: '#a21caf', fontSize: '0.75rem', fontWeight: 800,
                                                boxShadow: '0 4px 12px rgba(217, 70, 239, 0.1)'
                                            }}>
                                                <Shield size={14} />
                                                FUNDAMENTO LEGAL DETECTADO: {formData.legalCitation}
                                            </div>
                                        )}
                                        <div style={{ padding: '1rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', display: 'flex', gap: '0.75rem' }}>
                                            <Info size={16} color="#0369a1" style={{ flexShrink: 0 }} />
                                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#0369a1', lineHeight: 1.5 }}>{aiInsight}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '2rem', background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #f1f5f9' }}>
                                <div style={{ padding: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', color: '#fff' }}>
                                    <Activity size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Estado y Cronograma</h3>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}><Shield size={14} /> Estatus Actual</label>
                                    <select className="form-input" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0' }} value={formData.status} onChange={(e) => handleChange('status', e.target.value as ComplianceStatus)}>
                                        <option value="COMPLIANT">✅ Cumple</option>
                                        <option value="NON_COMPLIANT">❌ No Cumple</option>
                                        <option value="PARTIAL">⚠️ Cumplimiento Parcial</option>
                                        <option value="PENDING">🕐 Pendiente de Revisión</option>
                                        <option value="EXPIRED">⏰ Vencido</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}><Calendar size={14} /> Próxima Revisión</label>
                                    <input type="date" className="form-input" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '2px solid #e2e8f0' }} value={formData.nextReview} onChange={(e) => handleChange('nextReview', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '2rem', background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid #f1f5f9' }}>
                                <div style={{ padding: '8px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: '12px', color: '#fff' }}>
                                    <Info size={20} />
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>Observaciones & Hallazgos</h3>
                            </div>
                            <textarea className="form-input" style={{ width: '100%', minHeight: '100px', resize: 'vertical', padding: '1rem', fontSize: '0.95rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontFamily: 'inherit' }} value={formData.observations} onChange={(e) => handleChange('observations', e.target.value)} placeholder="Describa los hallazgos de la auditoría..." />
                        </div>
                    </form>
                </div>

                <div style={{ padding: '1.5rem 2.5rem', borderTop: '1px solid #e2e8f0', background: '#fafbfc', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button onClick={onClose} className="btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 600 }}>Cancelar</button>
                    <button type="submit" form="compliance-form" className="btn-primary" style={{ padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)', borderRadius: '12px', fontWeight: 600, color: '#fff', border: 'none', cursor: 'pointer' }}>
                        <Save size={18} style={{ marginRight: '8px' }} /> {initialData ? 'Guardar Cambios' : 'Crear Requisito'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};
