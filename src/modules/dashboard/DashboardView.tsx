import React from 'react';
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
    AlertCircle, Clock, FileText, CheckCircle, AlertTriangle, User,
    TrendingUp, RefreshCw, Printer, ShieldCheck, Fingerprint
} from 'lucide-react';
import { reportService } from '../shared/report.service.ts';
import type { User as AppUser } from '../../core/user.types.ts';
import { lawyerService } from '../legal-team/lawyers.service.ts';
import { documentService } from '../documents/documents.service.ts';
import { bcvRateService, type BcvRate } from '../shared/bcv-rate.service.ts';
import { auditService } from '../shared/audit.service.ts';
import { notificationService } from '../shared/notification.service.ts';
import { Bell } from 'lucide-react';

interface DashboardViewProps {
    user: AppUser;
}

const COLORS = ['#1e3a8a', '#dc2626', '#2563eb', '#9ca3af'];

export const DashboardView: React.FC<DashboardViewProps> = ({ user }) => {
    const [lawyers, setLawyers] = React.useState<any[]>([]);
    const [documents, setDocuments] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [chartsVisible, setChartsVisible] = React.useState(false);
    const [bcvRate, setBcvRate] = React.useState<BcvRate | null>(null);
    const [syncingRate, setSyncingRate] = React.useState(false);
    const [jurisdiction, setJurisdiction] = React.useState<'VE' | 'EU' | 'CA'>('VE');
    const [forensicHealth, setForensicHealth] = React.useState<{ healthy: boolean; details: string }>({ 
        healthy: true, 
        details: 'Analizando integridad SHA-256...' 
    });
    const [pendingAlerts, setPendingAlerts] = React.useState<any[]>([]);
    const [processingAlerts, setProcessingAlerts] = React.useState(false);

    const calculateLHI = () => {
        // Algoritmo de Salud Legal (LHI) Evolucionado (Vision 2026)
        let baseScore = 95; 
        
        // Penalización por Riesgo Operativo
        const criticalDocs = documents.filter(d => d.riskLevel === 'critical').length;
        const riskPenalty = criticalDocs * 8;
        
        // Penalización por Higiene de Firma (Contratos sin firmar pero activos)
        const unsignedActive = documents.filter(d => d.status === 'published' && !d.signature_hash).length;
        const hygienePenalty = unsignedActive * 4;

        // PENALIZACIÓN CRÍTICA: Integridad Forense (Pestaña c1)
        const forensicPenalty = forensicHealth.healthy ? 0 : 60;
        
        const result = Math.min(100, Math.max(0, baseScore - riskPenalty - hygienePenalty - forensicPenalty));
        
        return {
            score: result,
            status: forensicHealth.healthy ? (result > 85 ? 'ÓPTIMO' : result > 60 ? 'RIESGO MODERADO' : 'CRÍTICO') : 'BRECHA DE INTEGRIDAD',
            color: forensicHealth.healthy ? (result > 85 ? '#059669' : result > 60 ? '#ea580c' : '#dc2626') : '#991b1b'
        };
    };

    const lhi = calculateLHI();

    const handleSyncRate = async () => {
        setSyncingRate(true);
        try {
            const newRate = await bcvRateService.syncCurrentRate();
            setBcvRate(newRate);
        } catch (err) {
            console.error('Error syncing BCV rate:', err);
        } finally {
            setSyncingRate(false);
        }
    };

    const handleProcessAlerts = async () => {
        setProcessingAlerts(true);
        try {
            await notificationService.processDailyAlerts();
            const updated = await notificationService.getPendingAlerts();
            setPendingAlerts(updated);
        } catch (err) {
            console.error('Error processing alerts:', err);
        } finally {
            setProcessingAlerts(false);
        }
    };

    React.useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                const [lawyersData, documentsData, rateData] = await Promise.all([
                    lawyerService.getAll(),
                    documentService.getAll(),
                    bcvRateService.getTodayRate()
                ]);
                setLawyers(lawyersData);
                setDocuments(documentsData);
                setBcvRate(rateData);

                // Verificar Salud Forense (Fase 1.2) - Filtrado por Organización
                const health = await auditService.verifyChain(user.organizationId, 30);
                setForensicHealth(health);

                // Módulo 8: Alertas pendientes hoy
                const myAlerts = await notificationService.getPendingAlerts();
                setPendingAlerts(myAlerts);

                // Pequeño retraso para asegurar que el layout se ha estabilizado antes de mostrar los gráficos
                setTimeout(() => setChartsVisible(true), 100);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error loading dashboard data');
                console.error('Dashboard data loading error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Calculate workload based on real data
    const lawyerWorkload = lawyers.map(l => {
        const docCount = documents.filter(d => d.assignedTo === l.name).length;
        const pendingCount = documents.filter(d => d.assignedTo === l.name && d.status !== 'published').length;
        return {
            name: l.name,
            specialty: l.specialty,
            cases: docCount,
            pending: pendingCount
        };
    });

    const kpiData = [
        { label: 'Documentos Activos', value: documents.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
        { label: 'Alertas Críticas', value: documents.filter(d => d.riskLevel === 'critical').length, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
        { 
            label: 'Vencen < 7 días', 
            value: documents.filter(d => {
                if (!d.metadata?.expirationDate) return false;
                const expDate = new Date(d.metadata.expirationDate);
                const diffTime = expDate.getTime() - new Date().getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 7;
            }).length, 
            icon: Clock, 
            color: 'text-orange-600', 
            bg: 'bg-orange-50', 
            border: 'border-orange-200' 
        },
        { label: 'Cumplimiento', value: '92%', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' }
    ];

    const docStatusData = [
        { name: 'Publicado', value: documents.filter(d => d.status === 'published').length },
        { name: 'En Revisión', value: documents.filter(d => d.status === 'in_review').length },
        { name: 'Borrador', value: documents.filter(d => d.status === 'draft').length },
        { name: 'Otros', value: documents.filter(d => ['expired', 'archived', 'approved'].includes(d.status)).length }
    ];

    // Agrupar documentos por mes
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const currentMonthIdx = new Date().getMonth();
    const last6Months: { name: string, casos: number, monthYear: string }[] = [];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(currentMonthIdx - i);
        last6Months.push({
            name: months[d.getMonth()],
            casos: 0,
            monthYear: `${d.getMonth()}-${d.getFullYear()}`
        });
    }

    documents.forEach(doc => {
        const date = new Date(doc.createdAt || doc.created_at);
        const my = `${date.getMonth()}-${date.getFullYear()}`;
        const target = last6Months.find(m => m.monthYear === my);
        if (target) {
            target.casos++;
        }
    });

    const casesByMonth = last6Months.map(({ name, casos }) => ({ name, casos }));

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <p>Cargando dashboard...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#dc2626' }}>
                <p>Error al cargar el dashboard: {error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div style={{ 
                marginBottom: '2rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '1.5rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.025em', margin: 0 }}>
                        LegalOps Control Center
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '4px 0 0 0' }}>
                        Bienvenido, {user.name}. Monitor de Inteligencia Estratégica & Compliance.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '4px', borderRadius: '12px' }}>
                    {['VE', 'EU', 'CA'].map(j => (
                        <button 
                            key={j}
                            onClick={() => setJurisdiction(j as any)}
                            style={{ 
                                padding: '6px 16px', borderRadius: '8px', border: 'none',
                                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                background: jurisdiction === j ? '#fff' : 'transparent',
                                color: jurisdiction === j ? '#1e3a8a' : '#64748b',
                                boxShadow: jurisdiction === j ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            {j}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* BCV Rate Widget */}
                    <div className="premium-card" style={{ 
                        padding: '0.75rem 1.25rem', 
                        background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(30, 58, 138, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                                <TrendingUp size={18} color="#93c5fd" />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8, margin: 0 }}>Tasa Oficial BCV</p>
                                <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                                    {bcvRate?.usd_rate ? `${bcvRate.usd_rate} VES` : 'Cargando...'}
                                </p>
                            </div>
                        </div>
                        
                        <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '0.65rem', opacity: 0.7, margin: 0 }}>Actualizado</p>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>{bcvRate?.rate_date || '--/--/--'}</p>
                            </div>
                            <button 
                                onClick={handleSyncRate}
                                disabled={syncingRate}
                                style={{ 
                                    padding: '8px', 
                                    background: 'rgba(255,255,255,0.15)', 
                                    borderRadius: '8px',
                                    border: 'none',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                                className={syncingRate ? 'animate-spin' : ''}
                            >
                                <RefreshCw size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Forensic Health Widget */}
                    <div className="premium-card" style={{ 
                        padding: '0.75rem 1.25rem', 
                        background: forensicHealth.healthy ? 'linear-gradient(135deg, #065f46 0%, #059669 100%)' : 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                                {forensicHealth.healthy ? <ShieldCheck size={18} color="#6ee7b7" /> : <AlertTriangle size={18} color="#fca5a5" />}
                            </div>
                            <div>
                                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8, margin: 0 }}>Salud Forense SHA-256</p>
                                <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                                    {forensicHealth.healthy ? 'INMUTABLE' : 'BRECHA DETECTADA'}
                                </p>
                            </div>
                        </div>
                        
                        <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '0.65rem', opacity: 0.7, margin: 0 }}>Audit Chain</p>
                                <p style={{ fontSize: '0.75rem', fontWeight: 600, margin: 0 }}>{forensicHealth.healthy ? 'Verified ✓' : 'Alert ⚠'}</p>
                            </div>
                            <div 
                                title={forensicHealth.details}
                                style={{ 
                                    padding: '8px', 
                                    background: 'rgba(255,255,255,0.15)', 
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <Fingerprint size={16} />
                            </div>
                        </div>
                    </div>

                    {/* Notification Alerts Widget (Module 8) */}
                    <div className="premium-card" style={{ 
                        padding: '0.75rem 1.25rem', 
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        border: 'none',
                        boxShadow: '0 10px 15px -3px rgba(217, 119, 6, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                                <Bell size={18} color="#fef3c7" className={pendingAlerts.length > 0 ? "animate-bounce" : ""} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8, margin: 0 }}>Alertas IA (Módulo 8)</p>
                                <p style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                                    {pendingAlerts.length} Pendientes
                                </p>
                            </div>
                        </div>
                        
                        <div style={{ height: '30px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>

                        <button 
                            onClick={handleProcessAlerts}
                            disabled={processingAlerts || pendingAlerts.length === 0}
                            style={{ 
                                padding: '8px 12px', 
                                background: '#fff', 
                                color: '#d97706',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                opacity: (processingAlerts || pendingAlerts.length === 0) ? 0.6 : 1
                            }}
                        >
                            {processingAlerts ? 'Procesando...' : 'Ejecutar Envío'}
                        </button>
                    </div>
                </div>
            </div>

            {/* LHI & KPI Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1.5rem' }}>
                {/* LHI Gauge Card */}
                <div className="premium-card" style={{ 
                    padding: '1.5rem', 
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Legal Health Index (LHI)</p>
                    <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={lhi.color} strokeDasharray={`${lhi.score}, 100`} strokeWidth="3" strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
                        </svg>
                        <div style={{ position: 'absolute', textAlign: 'center' }}>
                            <p style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b', margin: 0 }}>{lhi.score}</p>
                            <p style={{ fontSize: '0.6rem', color: '#64748b', margin: 0 }}>SCORE</p>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', background: lhi.color + '20', color: lhi.color }}>
                            {lhi.status}
                        </span>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    {kpiData.map((kpi, idx) => (
                        <div key={idx} className="premium-card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>{kpi.label}</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>{kpi.value}</p>
                            </div>
                            <div style={{ padding: '10px', borderRadius: '10px', background: '#f1f5f9' }}>
                                <kpi.icon size={20} style={{ color: idx === 1 ? '#dc2626' : idx === 2 ? '#ea580c' : '#2563eb' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <button 
                    onClick={() => reportService.generateVencimientosReport()}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 1.2rem', borderRadius: '10px',
                        background: '#0f172a', color: '#fff', border: 'none',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                        boxShadow: '0 4px 6px -1px rgba(15,23,42,0.2)'
                    }}
                >
                    <Printer size={16} /> R-05 · Reporte de Vencimientos
                </button>
                <button 
                    onClick={() => reportService.generateFinOpsReport(user.organizationId || '')}
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 1.2rem', borderRadius: '10px',
                        background: '#1e3a8a', color: '#fff', border: 'none',
                        fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                        boxShadow: '0 4px 6px -1px rgba(30,58,138,0.2)'
                    }}
                >
                    <Printer size={16} /> R-09 · Informe FinOps Legal
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                {/* Charts */}
                <div className="premium-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>Estado de la Documentación</h3>
                    <div style={{ height: '280px' }}>
                        {chartsVisible && (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={docStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {docStatusData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="premium-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: 700 }}>Actividad Reciente (Casos)</h3>
                    <div style={{ height: '280px' }}>
                        {chartsVisible && (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={casesByMonth}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="casos" fill="#1e3a8a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Lawyer Workload */}
            <div className="premium-card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>
                    <User size={18} color="#1e3a8a" />
                    Distribución de Carga Legal
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    {lawyerWorkload.map((lawyer, idx) => (
                        <div key={idx} style={{ padding: '0.75rem', border: '1px solid #f1f5f9', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc' }}>
                            <div style={{ padding: '8px', background: '#fff', borderRadius: '50%', border: '1px solid #e2e8f0' }}>
                                <User size={20} color="#64748b" />
                            </div>
                            <div>
                                <p style={{ fontWeight: 600, color: '#0f172a', margin: 0, fontSize: '0.9rem' }}>{lawyer.name}</p>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{lawyer.specialty} • {lawyer.cases} docs</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Risk Heatmap Section (Pestaña c4) */}
            <div className="premium-card" style={{ marginTop: '1.5rem', padding: '2rem', background: '#fff', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>Mapa de Calor de Riesgo Multi-Jurisdiccional</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>Concentración de exposición patrimonial por materia y región.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: '#fef2f2', borderRadius: '2px', border: '1px solid #fee2e2' }}></div> Bajo</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: '#fee2e2', borderRadius: '2px' }}></div> Medio</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: '#f87171', borderRadius: '2px' }}></div> Alto</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '12px', height: '12px', background: '#991b1b', borderRadius: '2px' }}></div> CRÍTICO</div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <div style={{ minWidth: '600px', display: 'grid', gridTemplateColumns: '150px repeat(3, 1fr)', gap: '8px' }}>
                        {/* Headers */}
                        <div style={{ padding: '12px', fontSize: '0.75rem', fontWeight: 900, color: '#64748b' }}>MATERIA / ÁREA</div>
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: '#1e3a8a', background: '#f1f5f9', borderRadius: '8px' }}>VENEZUELA (VE)</div>
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: '#1e3a8a', background: '#f1f5f9', borderRadius: '8px' }}>EUROPA (EU)</div>
                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 800, color: '#1e3a8a', background: '#f1f5f9', borderRadius: '8px' }}>CARIBE (CA)</div>

                        {/* Real Dynamic Rows */}
                        {[
                            { label: 'LABORAL (LOTTT)', types: ['employment', 'laboral', 'regulatory'] },
                            { label: 'CUMPLIMIENTO & GOBIERNO', types: ['compliance', 'cumplimiento', 'corporate_governance'] },
                            { label: 'POLÍTICAS INTERNAS', types: ['policy', 'politica', 'politicas'] },
                            { label: 'CONTRATOS / NDA', types: ['nda', 'contract', 'service', 'commercial', 'NDA', 'COMMERCIAL'] },
                            { label: 'JUDICIAL / LITIGIO', types: ['judicial', 'litigation', 'expediente', 'litigio'] },
                        ].map((row, i) => (
                            <React.Fragment key={i}>
                                <div style={{ padding: '12px', fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center' }}>{row.label}</div>
                                {['VE', 'EU', 'CA'].map((j, idx) => {
                                    // Cálculo real basado en la salud de los documentos
                                    const docsInCell = documents.filter(d => {
                                        const dType = (d.type || '').toLowerCase();
                                        // Normalización de Jurisdicción (Mapeo de nombres completos a códigos)
                                        let dJuris = (d.metadata?.jurisdiction || 'VE').toUpperCase();
                                        if (dJuris.includes('VENEZUELA')) dJuris = 'VE';
                                        if (dJuris.includes('EUROPA') || dJuris.includes('SPAIN')) dJuris = 'EU';
                                        if (dJuris.includes('CARIBE') || dJuris.includes('PANAMA')) dJuris = 'CA';
                                        
                                        return row.types.map(t => t.toLowerCase()).includes(dType) && dJuris === j;
                                    });
                                    
                                    const val = docsInCell.length;
                                    // Nivel de riesgo real (Escala: si hay vencidos o criticidad alta)
                                    const hasCriticalRisk = docsInCell.some(d => d.riskLevel === 'critical' || d.riskLevel === 'high');
                                    
                                    const bgColor = val === 0 ? '#f8fafc' : hasCriticalRisk ? '#fee2e2' : val > 5 ? '#ffedd5' : '#f0fdf4';
                                    const textColor = val === 0 ? '#94a3b8' : hasCriticalRisk ? '#b91c1c' : val > 5 ? '#9a3412' : '#15803d';
                                    const intensity = val === 0 ? '#e2e8f0' : hasCriticalRisk ? '#dc2626' : val > 5 ? '#fb923c' : '#86efac';
                                    
                                    return (
                                        <div key={idx} style={{ 
                                            padding: '20px', borderRadius: '12px', cursor: 'help',
                                            background: `linear-gradient(135deg, ${bgColor} 0%, #fff 100%)`, 
                                            border: `1.5px solid ${intensity}20`,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            transition: 'transform 0.2s', position: 'relative', overflow: 'hidden'
                                        }}
                                        title={`${row.label} en ${j}: ${val} casos activos`}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        >
                                            <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', background: intensity }}></div>
                                            <span style={{ fontSize: '1.25rem', fontWeight: 900, color: textColor }}>{val}</span>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: textColor, textTransform: 'uppercase', marginTop: '2px' }}>Incidentes</span>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* High Risk Table */}
            <div className="premium-card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>
                    <AlertTriangle size={18} color="#dc2626" />
                    Prioridades de Cumplimiento (Riesgo Crítico)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #f1f5f9', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Documento</th>
                                <th style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Responsable</th>
                                <th style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Vencimiento</th>
                                <th style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.filter(d => d.riskLevel === 'high' || d.riskLevel === 'critical').slice(0, 5).map(doc => (
                                <tr key={doc.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                    <td style={{ padding: '0.75rem', fontSize: '0.9rem', fontWeight: 500 }}>{doc.title}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>{doc.assignedTo || 'Sin asignar'}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.85rem', fontWeight: 600, color: doc.riskLevel === 'critical' ? '#dc2626' : '#ea580c' }}>
                                        {doc.metadata?.expirationDate || 'N/A'}
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <span style={{ 
                                            padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700,
                                            background: doc.riskLevel === 'critical' ? '#fee2e2' : '#ffedd5',
                                            color: doc.riskLevel === 'critical' ? '#991b1b' : '#9a3412'
                                        }}>
                                            {doc.riskLevel.toUpperCase()}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
