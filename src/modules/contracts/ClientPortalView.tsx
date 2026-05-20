/**
 * ClientPortalView.tsx
 * Portal de cliente con acceso por token — Fase 5 Innovación
 *
 * Ruta pública: /portal/:token
 * No requiere login. El token se valida contra client_portal_tokens (Supabase).
 * Muestra los recursos del cliente según los flags de permiso del token.
 *
 * Seguridad:
 *   - La política RLS "portal_token_validate" permite SELECT sin auth.uid()
 *   - La validación de estado/expiración se hace aquí en la app
 *   - Incrementa access_count y actualiza last_accessed_at al validar
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Scale, FileText, Briefcase, Receipt, FolderOpen, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../core/supabase.ts';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PortalToken {
    id:                  string;
    organizationId:      string;
    clientId:            string;
    clientName:          string;
    clientEmail:         string;
    canSeeExpedientes:   boolean;
    canSeeContratos:     boolean;
    canSeeHonorarios:    boolean;
    canSeeDocumentos:    boolean;
    canUploadDocs:       boolean;
    status:              'active' | 'revoked' | 'expired';
    expiresAt:           string;
    accessCount:         number;
    maxAccesses:         number | null;
}

interface PortalExpediente {
    id:              string;
    titulo:          string;
    tipoProceso:     string;
    parteActora:     string;
    parteDemandada:  string;
    nuestraPosicion: string;
    status:          string;
    riesgo:          string;
    fechaInicio?:    string;
    tribunal?:       string;
}

interface PortalContrato {
    id:        string;
    title:     string;
    type:      string;
    status:    string;
    value?:    number;
    currency?: string;
    startDate?: string;
    endDate?:   string;
}

interface PortalFactura {
    id:             string;
    numeroFactura:  string;
    estado:         string;
    totalNeto:      number;
    currency?:      string;
    fechaEmision:   string;
    fechaVencimiento?: string;
}

// ── Helpers de display ────────────────────────────────────────────────────────

function statusBadge(status: string): React.ReactNode {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        ACTIVO:      { bg: '#f0fdf4', color: '#15803d', label: 'Activo'      },
        CERRADO:     { bg: '#f8fafc', color: '#64748b', label: 'Cerrado'     },
        GANADO:      { bg: '#eff6ff', color: '#1d4ed8', label: 'Ganado'      },
        PERDIDO:     { bg: '#fef2f2', color: '#b91c1c', label: 'Perdido'     },
        CONCILIADO:  { bg: '#f5f3ff', color: '#7c3aed', label: 'Conciliado'  },
        SUSPENDIDO:  { bg: '#fffbeb', color: '#d97706', label: 'Suspendido'  },
        active:      { bg: '#f0fdf4', color: '#15803d', label: 'Vigente'     },
        expired:     { bg: '#fef2f2', color: '#b91c1c', label: 'Expirado'    },
        terminated:  { bg: '#fef2f2', color: '#b91c1c', label: 'Terminado'   },
        draft:       { bg: '#f8fafc', color: '#64748b', label: 'Borrador'    },
        PAID:        { bg: '#f0fdf4', color: '#15803d', label: 'Pagada'      },
        PENDING:     { bg: '#fffbeb', color: '#d97706', label: 'Pendiente'   },
        OVERDUE:     { bg: '#fef2f2', color: '#b91c1c', label: 'Vencida'     },
    };
    const cfg = map[status] ?? { bg: '#f8fafc', color: '#64748b', label: status };
    return (
        <span style={{
            background: cfg.bg, color: cfg.color,
            padding: '2px 10px', borderRadius: 99, fontSize: '0.72rem', fontWeight: 700,
        }}>
            {cfg.label}
        </span>
    );
}

function formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Sub-componentes de sección ────────────────────────────────────────────────

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
            <div style={{
                background: '#eef2ff',
                borderRadius: 10,
                padding: '0.4rem',
                display: 'flex',
            }}>
                {icon}
            </div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                {title}
            </h2>
            <span style={{
                background: '#f1f5f9', color: '#64748b',
                borderRadius: 99, padding: '1px 10px', fontSize: '0.75rem', fontWeight: 700,
            }}>
                {count}
            </span>
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '1rem 1.25rem',
            marginBottom: '0.75rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
            {children}
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────

export const ClientPortalView: React.FC = () => {
    const { token } = useParams<{ token: string }>();

    const [loading,      setLoading]      = useState(true);
    const [portalToken,  setPortalToken]  = useState<PortalToken | null>(null);
    const [error,        setError]        = useState<string | null>(null);
    const [activeTab,    setActiveTab]    = useState<'expedientes' | 'contratos' | 'honorarios' | 'documentos'>('expedientes');

    const [expedientes,  setExpedientes]  = useState<PortalExpediente[]>([]);
    const [contratos,    setContratos]    = useState<PortalContrato[]>([]);
    const [facturas,     setFacturas]     = useState<PortalFactura[]>([]);

    const [loadingData,  setLoadingData]  = useState(false);

    // ── Validar token ────────────────────────────────────────────────────────

    useEffect(() => {
        if (!token) { setError('Token inválido.'); setLoading(false); return; }

        const validate = async () => {
            const { data, error: dbErr } = await supabase
                .from('client_portal_tokens')
                .select('*')
                .eq('token', token)
                .single();

            if (dbErr || !data) {
                setError('El enlace es inválido o ha sido revocado.');
                setLoading(false);
                return;
            }

            const row = data as Record<string, unknown>;

            // Validar status
            if (row.status !== 'active') {
                setError(row.status === 'revoked'
                    ? 'Este enlace ha sido revocado por el equipo legal.'
                    : 'Este enlace ha expirado.'
                );
                setLoading(false);
                return;
            }

            // Validar TTL
            if (new Date(row.expires_at as string) < new Date()) {
                setError('Este enlace ha expirado. Contacte a su abogado para obtener uno nuevo.');
                setLoading(false);
                return;
            }

            // Validar max_accesses
            const maxAcc = row.max_accesses as number | null;
            const acc    = row.access_count as number;
            if (maxAcc !== null && acc >= maxAcc) {
                setError('Este enlace ha alcanzado el número máximo de accesos permitidos.');
                setLoading(false);
                return;
            }

            // Token válido — mapear
            const pt: PortalToken = {
                id:                  row.id as string,
                organizationId:      row.organization_id as string,
                clientId:            row.client_id as string,
                clientName:          row.client_name as string,
                clientEmail:         row.client_email as string,
                canSeeExpedientes:   Boolean(row.can_see_expedientes),
                canSeeContratos:     Boolean(row.can_see_contratos),
                canSeeHonorarios:    Boolean(row.can_see_honorarios),
                canSeeDocumentos:    Boolean(row.can_see_documentos),
                canUploadDocs:       Boolean(row.can_upload_docs),
                status:              row.status as PortalToken['status'],
                expiresAt:           row.expires_at as string,
                accessCount:         acc,
                maxAccesses:         maxAcc,
            };

            setPortalToken(pt);

            // Incrementar contador de acceso (best-effort, sin bloquear)
            supabase
                .from('client_portal_tokens')
                .update({
                    access_count:      acc + 1,
                    last_accessed_at:  new Date().toISOString(),
                })
                .eq('id', pt.id)
                .then(() => {});

            // Set tab inicial según permisos
            if (pt.canSeeExpedientes)  setActiveTab('expedientes');
            else if (pt.canSeeContratos) setActiveTab('contratos');
            else if (pt.canSeeHonorarios) setActiveTab('honorarios');
            else if (pt.canSeeDocumentos) setActiveTab('documentos');

            setLoading(false);
        };

        validate();
    }, [token]);

    // ── Cargar datos según tab activo ─────────────────────────────────────────

    useEffect(() => {
        if (!portalToken) return;

        const load = async () => {
            setLoadingData(true);
            try {
                if (activeTab === 'expedientes' && portalToken.canSeeExpedientes && expedientes.length === 0) {
                    const { data } = await supabase
                        .from('expedientes')
                        .select('id, titulo, tipo_proceso, parte_actora, parte_demandada, nuestra_posicion, status, riesgo, fecha_inicio, tribunal')
                        .eq('organization_id', portalToken.organizationId)
                        .eq('client_id', portalToken.clientId);

                    setExpedientes((data ?? []).map(r => ({
                        id:              r.id as string,
                        titulo:          r.titulo as string,
                        tipoProceso:     r.tipo_proceso as string,
                        parteActora:     r.parte_actora as string,
                        parteDemandada:  r.parte_demandada as string,
                        nuestraPosicion: r.nuestra_posicion as string,
                        status:          r.status as string,
                        riesgo:          r.riesgo as string,
                        fechaInicio:     r.fecha_inicio as string | undefined,
                        tribunal:        r.tribunal as string | undefined,
                    })));
                }

                if (activeTab === 'contratos' && portalToken.canSeeContratos && contratos.length === 0) {
                    const { data } = await supabase
                        .from('contracts')
                        .select('id, title, type, status, value, currency, start_date, end_date')
                        .eq('organization_id', portalToken.organizationId)
                        .eq('client_id', portalToken.clientId);

                    setContratos((data ?? []).map(r => ({
                        id:        r.id as string,
                        title:     r.title as string,
                        type:      r.type as string,
                        status:    r.status as string,
                        value:     r.value ? Number(r.value) : undefined,
                        currency:  r.currency as string | undefined,
                        startDate: r.start_date as string | undefined,
                        endDate:   r.end_date as string | undefined,
                    })));
                }

                if (activeTab === 'honorarios' && portalToken.canSeeHonorarios && facturas.length === 0) {
                    const { data } = await supabase
                        .from('invoices')
                        .select('id, number, status, total, currency, issued_at, due_at')
                        .eq('organization_id', portalToken.organizationId)
                        .eq('client_id', portalToken.clientId);

                    setFacturas((data ?? []).map(r => ({
                        id:               r.id as string,
                        numeroFactura:    r.number as string,
                        estado:           r.status as string,
                        totalNeto:        Number(r.total ?? 0),
                        currency:         r.currency as string | undefined,
                        fechaEmision:     r.issued_at as string,
                        fechaVencimiento: r.due_at as string | undefined,
                    })));
                }
            } finally {
                setLoadingData(false);
            }
        };

        load();
    }, [activeTab, portalToken]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Estados de carga y error ──────────────────────────────────────────────

    if (loading) {
        return (
            <div style={centeredScreen}>
                <Clock size={32} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#64748b', marginTop: 16 }}>Verificando acceso…</p>
            </div>
        );
    }

    if (error || !portalToken) {
        return (
            <div style={centeredScreen}>
                <AlertTriangle size={40} color="#b91c1c" />
                <h2 style={{ color: '#b91c1c', margin: '1rem 0 0.5rem', fontSize: '1.1rem' }}>
                    Acceso no disponible
                </h2>
                <p style={{ color: '#64748b', textAlign: 'center', maxWidth: 340 }}>
                    {error ?? 'Enlace inválido.'}
                </p>
                <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '1rem' }}>
                    Si crees que es un error, contacta a tu abogado.
                </p>
            </div>
        );
    }

    // ── Tabs disponibles ──────────────────────────────────────────────────────

    type TabId = typeof activeTab;
    const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode; perm: boolean }> =
        ([
            { id: 'expedientes', label: 'Expedientes',  icon: <Scale      size={15} />, perm: portalToken.canSeeExpedientes },
            { id: 'contratos',   label: 'Contratos',    icon: <FileText   size={15} />, perm: portalToken.canSeeContratos   },
            { id: 'honorarios',  label: 'Honorarios',   icon: <Receipt    size={15} />, perm: portalToken.canSeeHonorarios  },
            { id: 'documentos',  label: 'Documentos',   icon: <FolderOpen size={15} />, perm: portalToken.canSeeDocumentos  },
        ] as Array<{ id: TabId; label: string; icon: React.ReactNode; perm: boolean }>)
        .filter(t => t.perm);

    // ── Render principal ──────────────────────────────────────────────────────

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

            {/* Header */}
            <header style={{
                background: '#fff',
                borderBottom: '1px solid #e2e8f0',
                padding: '1rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        borderRadius: 10,
                        padding: '0.5rem',
                        display: 'flex',
                    }}>
                        <Briefcase size={20} color="#fff" />
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>
                            Portal del Cliente
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Acceso seguro a su expediente legal
                        </div>
                    </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                        {portalToken.clientName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        Enlace válido hasta {formatDate(portalToken.expiresAt)}
                    </div>
                </div>
            </header>

            {/* Contenido */}
            <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>

                {/* Banner de bienvenida */}
                <div style={{
                    background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)',
                    border: '1px solid #c7d2fe',
                    borderRadius: 16,
                    padding: '1.25rem 1.5rem',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                }}>
                    <CheckCircle2 size={24} color="#6366f1" />
                    <div>
                        <div style={{ fontWeight: 700, color: '#4338ca', fontSize: '0.9rem' }}>
                            Bienvenido/a, {portalToken.clientName}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#6366f1', marginTop: 2 }}>
                            Acceso seguro y confidencial. La información mostrada es exclusiva para usted.
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                {tabs.length > 1 && (
                    <div style={{
                        display: 'flex', gap: 4, marginBottom: '1.5rem',
                        background: '#fff', borderRadius: 12, padding: 4,
                        border: '1px solid #e2e8f0', width: 'fit-content',
                    }}>
                        {tabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                style={{
                                    background: activeTab === t.id ? '#6366f1' : 'transparent',
                                    color: activeTab === t.id ? '#fff' : '#64748b',
                                    border: 'none',
                                    borderRadius: 9,
                                    padding: '0.5rem 1rem',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    transition: 'background 0.15s, color 0.15s',
                                }}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Loading data spinner */}
                {loadingData && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        <Clock size={24} style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ marginTop: 8, fontSize: '0.85rem' }}>Cargando…</p>
                    </div>
                )}

                {/* ── Expedientes ─────────────────────────────────────────────── */}
                {!loadingData && activeTab === 'expedientes' && portalToken.canSeeExpedientes && (
                    <div>
                        <SectionHeader
                            icon={<Scale size={18} color="#6366f1" />}
                            title="Expedientes"
                            count={expedientes.length}
                        />
                        {expedientes.length === 0 ? (
                            <EmptyState message="No hay expedientes para mostrar." />
                        ) : expedientes.map(exp => (
                            <Card key={exp.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', flex: 1 }}>
                                        {exp.titulo}
                                    </h3>
                                    {statusBadge(exp.status)}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <DataRow label="Tipo" value={exp.tipoProceso} />
                                    <DataRow label="Posición" value={exp.nuestraPosicion} />
                                    <DataRow label="Parte Actora" value={exp.parteActora} />
                                    <DataRow label="Parte Demandada" value={exp.parteDemandada} />
                                    {exp.tribunal && <DataRow label="Tribunal" value={exp.tribunal} />}
                                    {exp.fechaInicio && <DataRow label="Inicio" value={formatDate(exp.fechaInicio)} />}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* ── Contratos ────────────────────────────────────────────────── */}
                {!loadingData && activeTab === 'contratos' && portalToken.canSeeContratos && (
                    <div>
                        <SectionHeader
                            icon={<FileText size={18} color="#6366f1" />}
                            title="Contratos"
                            count={contratos.length}
                        />
                        {contratos.length === 0 ? (
                            <EmptyState message="No hay contratos para mostrar." />
                        ) : contratos.map(c => (
                            <Card key={c.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', flex: 1 }}>
                                        {c.title}
                                    </h3>
                                    {statusBadge(c.status)}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <DataRow label="Tipo" value={c.type} />
                                    {c.value !== undefined && (
                                        <DataRow label="Valor" value={`${c.currency ?? ''} ${c.value.toLocaleString()}`} />
                                    )}
                                    {c.startDate && <DataRow label="Vigencia desde" value={formatDate(c.startDate)} />}
                                    {c.endDate && <DataRow label="Vigencia hasta" value={formatDate(c.endDate)} />}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* ── Honorarios ───────────────────────────────────────────────── */}
                {!loadingData && activeTab === 'honorarios' && portalToken.canSeeHonorarios && (
                    <div>
                        <SectionHeader
                            icon={<Receipt size={18} color="#6366f1" />}
                            title="Facturas y Honorarios"
                            count={facturas.length}
                        />
                        {facturas.length === 0 ? (
                            <EmptyState message="No hay facturas para mostrar." />
                        ) : facturas.map(f => (
                            <Card key={f.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                                            Factura #{f.numeroFactura}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                                            Emitida: {formatDate(f.fechaEmision)}
                                            {f.fechaVencimiento && ` · Vence: ${formatDate(f.fechaVencimiento)}`}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>
                                            {f.currency ?? 'USD'} {f.totalNeto.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div style={{ marginTop: 4 }}>{statusBadge(f.estado)}</div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}

                {/* ── Documentos ───────────────────────────────────────────────── */}
                {!loadingData && activeTab === 'documentos' && portalToken.canSeeDocumentos && (
                    <div>
                        <SectionHeader
                            icon={<FolderOpen size={18} color="#6366f1" />}
                            title="Documentos"
                            count={0}
                        />
                        <EmptyState message="La gestión de documentos del portal estará disponible próximamente." />
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer style={{
                padding: '2rem',
                textAlign: 'center',
                fontSize: '0.72rem',
                color: '#94a3b8',
                borderTop: '1px solid #f1f5f9',
            }}>
                Portal seguro · La información es confidencial y de uso exclusivo del destinatario
                · Accesos: {portalToken.accessCount + 1}
                {portalToken.maxAccesses ? ` / ${portalToken.maxAccesses}` : ''}
            </footer>
        </div>
    );
};

// ── Helpers de layout ─────────────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: 500, marginTop: 2 }}>
                {value || '—'}
            </div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div style={{
            textAlign: 'center', padding: '2.5rem',
            background: '#fff', borderRadius: 14,
            border: '1px solid #e2e8f0', color: '#94a3b8',
            fontSize: '0.875rem',
        }}>
            <FolderOpen size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p style={{ margin: 0 }}>{message}</p>
        </div>
    );
}

const centeredScreen: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '2rem',
};
