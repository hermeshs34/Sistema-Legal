import React, { useState, useEffect } from 'react';
import {
    AlertOctagon, ShieldAlert, Brain, Activity
} from 'lucide-react';
import { complianceService } from './compliance.service.ts';
import { aiService } from '../documents/ai.service.ts';
import type { ComplianceItem } from './types.ts';

export const RiskMatrixView: React.FC = () => {
    const [items, setItems] = useState<ComplianceItem[]>([]);
    const [aiSummary, setAiSummary] = useState<string>('Analizando exposición global...');
    const [loadingAi, setLoadingAi] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            const data = await complianceService.getAll();
            setItems(data);
            
            if (data.length > 0) {
                try {
                    const desc = data.map(i => `${i.title}: ${i.riskLevel}`).join(', ');
                    const summary = await aiService.query(
                            `Analiza esta lista de riesgos de cumplimiento y da un resumen ejecutivo de 2 párrafos sobre la exposición actual: ${desc}`,
                            'Eres un experto en compliance legal venezolano.'
                        );
                    setAiSummary(summary);
                } catch (e) {
                    setAiSummary('Exposición moderada basada en el catálogo de cumplimiento actual.');
                } finally {
                    setLoadingAi(false);
                }
            }
        };
        fetch();
    }, []);

    // Impact vs Probability logic
    const riskData = items.map(item => ({
        ...item,
        impact: item.riskLevel === 'CRITICAL' ? 5 : item.riskLevel === 'HIGH' ? 4 : item.riskLevel === 'MEDIUM' ? 3 : 2,
        probability: item.status === 'NON_COMPLIANT' ? 5 : item.status === 'EXPIRED' ? 5 : item.status === 'PARTIAL' ? 3 : 1
    }));

    return (
        <div className="space-y-6" style={{ fontFamily: 'var(--font-body)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ padding: '12px', background: '#ef4444', borderRadius: '16px', color: '#fff' }}>
                    <AlertOctagon size={32} />
                </div>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Matriz de Riesgos Estratégicos</h2>
                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Análisis de Probabilidad vs Impacto de hallazgos de cumplimiento.</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div className="premium-card" style={{ background: '#fff', padding: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2rem' }}>Mapa de Calor de Riesgos (NIST/ISO 31000)</h3>
                    <div style={{
                        display: 'grid', gridTemplateColumns: '40px 1fr', gridTemplateRows: '1fr 40px', gap: '10px',
                        height: '450px', position: 'relative'
                    }}>
                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>IMPACTO</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(5, 1fr)', gap: '4px', border: '2px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            {Array.from({ length: 25 }).map((_, i) => {
                                const row = 5 - Math.floor(i / 5);
                                const col = (i % 5) + 1;
                                const score = row * col;
                                let bg = '#f0fdf4';
                                if (score >= 15) bg = '#fef2f2';
                                else if (score >= 8) bg = '#fffbeb';

                                return (
                                    <div key={i} style={{
                                        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        position: 'relative', border: '1px solid rgba(0,0,0,0.03)'
                                    }}>
                                        {riskData.filter(r => r.impact === row && r.probability === col).map((r) => (
                                            <div key={r.id} style={{
                                                width: '12px', height: '12px', borderRadius: '50%', background: '#1e293b',
                                                cursor: 'pointer', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }} title={r.title} />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                        <div></div>
                        <div style={{ textAlign: 'center', fontWeight: 700, color: '#64748b', paddingTop: '10px' }}>PROBABILIDAD / OCURRENCIA</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="premium-card" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', padding: '1.5rem', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.1 }}><Brain size={80} /></div>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 800, margin: '0 0 1rem 0' }}>
                            <Brain size={18} /> INSIGHT IA DE EXPOSICIÓN
                        </h4>
                        <p style={{ fontSize: '0.82rem', lineHeight: 1.6, margin: 0, position: 'relative', zIndex: 1, opacity: 0.95 }}>
                            {loadingAi ? 'Calculando vectores de riesgo...' : aiSummary}
                        </p>
                    </div>

                    <div className="premium-card" style={{ background: '#fff', padding: '1.5rem', border: '1px solid #fee2e2' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 800, color: '#b91c1c', margin: '0 0 1rem 0' }}>
                            <ShieldAlert size={18} /> PRIORIDAD MÁXIMA
                        </h4>
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {riskData.filter(r => r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH').slice(0, 3).map(r => (
                                <div key={r.id} style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '10px', borderLeft: '4px solid #ef4444' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#991b1b' }}>{r.title}</div>
                                    <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '2px', fontWeight: 600 }}>Zona de Impacto Crítico</div>
                                </div>
                            ))}
                            {riskData.filter((r: any) => r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH').length === 0 && (
                                <div style={{ textAlign: 'center', padding: '1rem', color: '#64748b', fontSize: '0.8rem' }}>No hay riesgos críticos detectados.</div>
                            )}
                        </div>
                    </div>

                    <div className="premium-card" style={{ background: '#0f172a', padding: '1.5rem', color: '#fff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <Activity size={20} color="#38bdf8" />
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Métricas de Salud Normativa</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444' }}>{riskData.filter((r: any) => r.impact * r.probability >= 15).length}</div>
                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>Exposición Alta</div>
                            </div>
                            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{riskData.filter((r: any) => r.status === 'COMPLIANT').length}</div>
                                <div style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginTop: '4px' }}>Cumplimiento</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
