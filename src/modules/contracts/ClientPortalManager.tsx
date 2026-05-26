/**
 * ClientPortalManager.tsx
 * Panel de gestión de tokens del Portal de Cliente — Fase 5 Innovación
 *
 * Permite al equipo legal:
 * - Crear enlaces de acceso al portal con TTL y permisos granulares
 * - Ver todos los tokens activos y su estado de uso
 * - Revocar accesos en cualquier momento
 * - Copiar el enlace para enviarlo al cliente
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Link2, Plus, Trash2, Copy, Check, Clock, Users,
    Eye, EyeOff, RefreshCw, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../core/supabase.ts';
import { authService } from '../../core/auth.service.ts';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface PortalToken {
    id:                  string;
    token:               string;
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
    lastAccessedAt?:     string;
    accessCount:         number;
    maxAccesses?:        number;
    createdAt:           string;
}

interface ClientOption { id: string; name: string; email?: string; }

// ── Helpers ──────────────────────────────────────────────────────────────────

function portalUrl(token: string): string {
    return `${window.location.origin}/portal/${token}`;
}

function formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
}

function daysLeft(expiresAt: string): number {
    return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function mapToken(row: Record<string, unknown>): PortalToken {
    const status = row.status as string;
    return {
        id:                  row.id as string,
        token:               row.token as string,
        clientId:            row.client_id as string,
        clientName:          row.client_name as string,
        clientEmail:         row.client_email as string,
        canSeeExpedientes:   Boolean(row.can_see_expedientes),
        canSeeContratos:     Boolean(row.can_see_contratos),
        canSeeHonorarios:    Boolean(row.can_see_honorarios),
        canSeeDocumentos:    Boolean(row.can_see_documentos),
        canUploadDocs:       Boolean(row.can_upload_docs),
        status:              (isExpired(row.expires_at as string) && status === 'active' ? 'expired' : status) as PortalToken['status'],
        expiresAt:           row.expires_at as string,
        lastAccessedAt:      row.last_accessed_at as string | undefined,
        accessCount:         Number(row.access_count ?? 0),
        maxAccesses:         row.max_accesses as number | undefined,
        createdAt:           row.created_at as string,
    };
}

// ── Formulario de creación ────────────────────────────────────────────────────

interface CreateFormProps {
    clients:  ClientOption[];
    orgId:    string;
    onCreated: () => void;
    onCancel:  () => void;
}

const CreateTokenForm: React.FC<CreateFormProps> = ({ clients, orgId, onCreated, onCancel }) => {
    const user = authService.getCurrentUser();
    const [form, setForm] = useState({
        clientId:          '',
        clientName:        '',
        clientEmail:       '',
        canSeeExpedientes: true,
        canSeeContratos:   true,
        canSeeHonorarios:  false,
        canSeeDocumentos:  false,
        canUploadDocs:     false,
        ttlDays:           30,
        maxAccesses:       '',
    });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const handleClientSelect = (id: string) => {
        const c = clients.find(cl => cl.id === id);
        setForm(prev => ({
            ...prev,
            clientId:    id,
            clientName:  c?.name ?? '',
            clientEmail: c?.email ?? '',
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // SEGURIDAD: el cliente DEBE existir en la tabla clients.
        // Sin un client_id real no se puede filtrar facturas, ni hacer
        // matching tolerante de expedientes/contratos contra el nombre real.
        if (!form.clientId) {
            setError('Debes seleccionar un cliente existente del módulo de Honorarios. Si no aparece, créalo primero allí.');
            return;
        }
        if (!form.clientEmail.trim()) {
            setError('El email del cliente es obligatorio.');
            return;
        }
        // Al menos un permiso debe estar activo, si no el portal no muestra nada
        const hasAnyPermission = form.canSeeExpedientes
            || form.canSeeContratos
            || form.canSeeHonorarios
            || form.canSeeDocumentos;
        if (!hasAnyPermission) {
            setError('Debes activar al menos UN permiso. Sin permisos el cliente verá un portal vacío.');
            return;
        }
        setSaving(true);
        setError('');

        const expiresAt = new Date(Date.now() + form.ttlDays * 86400000).toISOString();

        const { error: dbErr } = await supabase.from('client_portal_tokens').insert({
            organization_id:     orgId,
            client_id:           form.clientId,
            client_name:         form.clientName.trim(),
            client_email:        form.clientEmail.trim().toLowerCase(),
            can_see_expedientes: form.canSeeExpedientes,
            can_see_contratos:   form.canSeeContratos,
            can_see_honorarios:  form.canSeeHonorarios,
            can_see_documentos:  form.canSeeDocumentos,
            can_upload_docs:     form.canUploadDocs,
            expires_at:          expiresAt,
            max_accesses:        form.maxAccesses ? Number(form.maxAccesses) : null,
            created_by:          user?.id ?? null,
        });

        setSaving(false);
        if (dbErr) { setError(dbErr.message); return; }
        onCreated();
    };

    const toggle = (field: keyof typeof form) => setForm(prev => ({ ...prev, [field]: !prev[field as keyof typeof form] }));

    const inp: React.CSSProperties = {
        width: '100%', padding: '0.6rem 0.9rem', borderRadius: 8,
        border: '1px solid #e2e8f0', background: '#f8fafc',
        fontSize: '0.83rem', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
    };
    const lbl: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 3, textTransform: 'uppercase' };

    return (
        <form onSubmit={handleSubmit} style={{
            background: '#fff', border: '2px solid #c7d2fe', borderRadius: 16,
            padding: '1.5rem', marginBottom: '1.5rem',
        }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 800, color: '#4338ca', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} /> Nuevo Token de Acceso
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                    <label style={lbl}>Cliente del módulo de Honorarios *</label>
                    <select
                        style={inp}
                        value={form.clientId}
                        onChange={e => handleClientSelect(e.target.value)}
                        required
                    >
                        <option value="">— Seleccionar cliente existente —</option>
                        {clients.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.name}{c.email ? ` (${c.email})` : ''}
                            </option>
                        ))}
                    </select>
                    {clients.length === 0 && (
                        <p style={{ margin: '6px 0 0', fontSize: '0.72rem', color: '#b45309' }}>
                            ⚠️ No hay clientes registrados. Créalos primero desde el módulo de Honorarios → Clientes.
                        </p>
                    )}
                </div>
                <div>
                    <label style={lbl}>Email del cliente *</label>
                    <input
                        style={inp}
                        type="email"
                        placeholder="cliente@empresa.com"
                        value={form.clientEmail}
                        onChange={e => setForm(prev => ({ ...prev, clientEmail: e.target.value }))}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                        Se autocompleta con el email del cliente si lo tiene registrado. Puedes corregirlo aquí.
                    </p>
                </div>
            </div>

            {/* Permisos */}
            <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ ...lbl, marginBottom: 8 }}>
                    Permisos del portal — <span style={{ color: '#b91c1c', textTransform: 'none' }}>click para activar/desactivar</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {([
                        ['canSeeExpedientes', '⚖️ Expedientes'],
                        ['canSeeContratos',   '📄 Contratos'],
                        ['canSeeHonorarios',  '💰 Honorarios'],
                        ['canSeeDocumentos',  '📁 Documentos'],
                        ['canUploadDocs',     '⬆️ Subir docs'],
                    ] as const).map(([field, label]) => {
                        const isOn = form[field] as boolean;
                        return (
                            <button
                                key={field}
                                type="button"
                                onClick={() => toggle(field)}
                                style={{
                                    padding: '0.5rem 1rem', borderRadius: 20,
                                    border: `2px solid ${isOn ? '#15803d' : '#cbd5e1'}`,
                                    background: isOn ? '#22c55e' : '#f1f5f9',
                                    color: isOn ? '#fff' : '#64748b',
                                    fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    boxShadow: isOn ? '0 2px 6px rgba(34,197,94,0.3)' : 'none',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <span style={{
                                    width: 14, height: 14, borderRadius: 4,
                                    background: isOn ? '#fff' : '#cbd5e1',
                                    color: isOn ? '#15803d' : '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.7rem', fontWeight: 900,
                                }}>
                                    {isOn ? '✓' : '✕'}
                                </span>
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Resumen visual de permisos seleccionados */}
            <div style={{
                marginBottom: '1rem',
                padding: '0.7rem 1rem',
                background: (form.canSeeExpedientes || form.canSeeContratos || form.canSeeHonorarios || form.canSeeDocumentos)
                    ? '#f0fdf4' : '#fef2f2',
                border: `1.5px solid ${(form.canSeeExpedientes || form.canSeeContratos || form.canSeeHonorarios || form.canSeeDocumentos)
                    ? '#86efac' : '#fca5a5'}`,
                borderRadius: 10,
                fontSize: '0.8rem',
                color: (form.canSeeExpedientes || form.canSeeContratos || form.canSeeHonorarios || form.canSeeDocumentos)
                    ? '#15803d' : '#b91c1c',
                fontWeight: 600,
            }}>
                {(() => {
                    const active: string[] = [];
                    if (form.canSeeExpedientes) active.push('Expedientes');
                    if (form.canSeeContratos)   active.push('Contratos');
                    if (form.canSeeHonorarios)  active.push('Honorarios');
                    if (form.canSeeDocumentos)  active.push('Documentos');
                    if (active.length === 0) {
                        return '⚠️ Sin permisos: el cliente verá un portal vacío. Activa al menos uno.';
                    }
                    return `✅ El cliente podrá ver: ${active.join(', ')}`;
                })()}
            </div>

            {/* TTL y max accesses */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                    <label style={lbl}>Validez (días) *</label>
                    <input style={inp} type="number" min="1" max="365" value={form.ttlDays}
                        onChange={e => setForm(prev => ({ ...prev, ttlDays: Number(e.target.value) }))} />
                </div>
                <div>
                    <label style={lbl}>Máx. accesos (vacío = ilimitado)</label>
                    <input style={inp} type="number" min="1" placeholder="Ej: 10"
                        value={form.maxAccesses}
                        onChange={e => setForm(prev => ({ ...prev, maxAccesses: e.target.value }))} />
                </div>
            </div>

            {error && <p style={{ color: '#b91c1c', fontSize: '0.78rem', margin: '0 0 0.75rem' }}>⚠️ {error}</p>}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={onCancel} style={{
                    padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid #e2e8f0',
                    background: '#fff', color: '#64748b', fontWeight: 600, fontSize: '0.83rem', cursor: 'pointer',
                }}>
                    Cancelar
                </button>
                <button type="submit" disabled={saving} style={{
                    padding: '0.6rem 1.5rem', borderRadius: 8, border: 'none',
                    background: saving ? '#94a3b8' : '#6366f1',
                    color: '#fff', fontWeight: 700, fontSize: '0.83rem', cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                    {saving ? 'Creando…' : '🔗 Crear enlace'}
                </button>
            </div>
        </form>
    );
};

// ── Fila de token ─────────────────────────────────────────────────────────────

function TokenRow({
    tok,
    onRevoke,
    onCopy,
    copiedId,
}: {
    tok:      PortalToken;
    onRevoke: (id: string) => void;
    onCopy:   (id: string, url: string) => void;
    copiedId: string | null;
}) {
    const statusCfg = {
        active:  { bg: '#f0fdf4', color: '#15803d', label: 'Activo'   },
        expired: { bg: '#fef2f2', color: '#b91c1c', label: 'Expirado' },
        revoked: { bg: '#f8fafc', color: '#64748b', label: 'Revocado' },
    }[tok.status];

    const days = daysLeft(tok.expiresAt);
    const url  = portalUrl(tok.token);

    const permBadge = (on: boolean, label: string) => on ? (
        <span key={label} style={{
            fontSize: '0.65rem', padding: '1px 7px', borderRadius: 99,
            background: '#eef2ff', color: '#4f46e5', fontWeight: 600,
        }}>{label}</span>
    ) : null;

    return (
        <div style={{
            background: tok.status !== 'active' ? '#f8fafc' : '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '0.9rem 1.1rem',
            opacity: tok.status !== 'active' ? 0.7 : 1,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>
                        {tok.clientName}
                        {' '}
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 400 }}>
                            {tok.clientEmail}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                        {permBadge(tok.canSeeExpedientes, '⚖️')}
                        {permBadge(tok.canSeeContratos,   '📄')}
                        {permBadge(tok.canSeeHonorarios,  '💰')}
                        {permBadge(tok.canSeeDocumentos,  '📁')}
                        {permBadge(tok.canUploadDocs,     '⬆️')}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{
                        padding: '2px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700,
                        background: statusCfg.bg, color: statusCfg.color,
                    }}>
                        {statusCfg.label}
                    </span>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>
                        <Clock size={11} style={{ verticalAlign: 'middle' }} />
                        {' '}
                        {tok.status === 'active' && days > 0
                            ? `Expira en ${days}d (${formatDate(tok.expiresAt)})`
                            : `Expiró ${formatDate(tok.expiresAt)}`
                        }
                    </span>
                    <span>
                        <Eye size={11} style={{ verticalAlign: 'middle' }} />
                        {' '}
                        {tok.accessCount} acceso{tok.accessCount !== 1 ? 's' : ''}
                        {tok.maxAccesses ? ` / ${tok.maxAccesses}` : ''}
                        {tok.lastAccessedAt ? ` · Último: ${formatDate(tok.lastAccessedAt)}` : ''}
                    </span>
                </div>

                {tok.status === 'active' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={() => onCopy(tok.id, url)}
                            style={{
                                padding: '0.35rem 0.85rem', borderRadius: 7,
                                border: '1px solid #c7d2fe', background: '#eef2ff',
                                color: '#4f46e5', fontWeight: 600, fontSize: '0.75rem',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            {copiedId === tok.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === tok.id ? 'Copiado' : 'Copiar enlace'}
                        </button>
                        <button
                            onClick={() => onRevoke(tok.id)}
                            style={{
                                padding: '0.35rem 0.85rem', borderRadius: 7,
                                border: '1px solid #fecaca', background: '#fef2f2',
                                color: '#b91c1c', fontWeight: 600, fontSize: '0.75rem',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            <Trash2 size={12} /> Revocar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Componente principal ──────────────────────────────────────────────────────

export const ClientPortalManager: React.FC = () => {
    const user = authService.getCurrentUser();
    const orgId = user?.organizationId ?? '';

    const [tokens,    setTokens]    = useState<PortalToken[]>([]);
    const [clients,   setClients]   = useState<ClientOption[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [showForm,  setShowForm]  = useState(false);
    const [copiedId,  setCopiedId]  = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'revoked'>('active');

    const MANAGE_ROLES = ['consultor_general', 'abogado_senior', 'gerente_firma'];
    const canManage = user && MANAGE_ROLES.includes(user.role);

    const load = useCallback(async () => {
        setLoading(true);
        const [tokRes, clRes] = await Promise.all([
            supabase.from('client_portal_tokens').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
            supabase.from('clients').select('id, name, email').eq('organization_id', orgId).eq('is_active', true).order('name'),
        ]);
        setTokens((tokRes.data ?? []).map(r => mapToken(r as Record<string, unknown>)));
        setClients((clRes.data ?? []).map(r => ({ id: r.id as string, name: r.name as string, email: r.email as string | undefined })));
        setLoading(false);
    }, [orgId]);

    useEffect(() => { load(); }, [load]);

    const handleRevoke = async (id: string) => {
        if (!confirm('¿Revocar este acceso? El cliente perderá el acceso inmediatamente.')) return;
        await supabase.from('client_portal_tokens').update({
            status: 'revoked',
            revoked_by: user?.id,
            revoked_at: new Date().toISOString(),
        }).eq('id', id).eq('organization_id', orgId);
        load();
    };

    const handleCopy = async (id: string, url: string) => {
        await navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2500);
    };

    const filtered = tokens.filter(t =>
        filterStatus === 'all' ? true : t.status === filterStatus
    );

    const activeCount  = tokens.filter(t => t.status === 'active').length;
    const expiredCount = tokens.filter(t => t.status === 'expired').length;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Link2 size={20} color="#6366f1" />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                            Portal de Cliente — Gestión de Accesos
                        </h3>
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        {activeCount} acceso{activeCount !== 1 ? 's' : ''} activo{activeCount !== 1 ? 's' : ''}
                        {expiredCount > 0 && ` · ${expiredCount} expirado${expiredCount !== 1 ? 's' : ''}`}
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => load()} style={{
                        padding: '0.5rem 0.9rem', borderRadius: 8,
                        border: '1px solid #e2e8f0', background: '#fff',
                        color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: '0.78rem',
                    }}>
                        <RefreshCw size={13} /> Actualizar
                    </button>
                    {canManage && (
                        <button onClick={() => setShowForm(p => !p)} style={{
                            padding: '0.5rem 1rem', borderRadius: 8,
                            border: 'none', background: '#6366f1', color: '#fff',
                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                            <Plus size={14} /> Nuevo acceso
                        </button>
                    )}
                </div>
            </div>

            {/* Aviso de rol */}
            {!canManage && (
                <div style={{
                    background: '#fffbeb', border: '1px solid #fcd34d',
                    borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1rem',
                    fontSize: '0.8rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <AlertTriangle size={15} />
                    Solo Consultor General, Abogado Senior y Gerente pueden crear o revocar accesos.
                </div>
            )}

            {/* Formulario de creación */}
            {showForm && canManage && (
                <CreateTokenForm
                    clients={clients}
                    orgId={orgId}
                    onCreated={() => { setShowForm(false); load(); }}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 4, marginBottom: '1rem' }}>
                {(['all', 'active', 'expired', 'revoked'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setFilterStatus(s)}
                        style={{
                            padding: '0.3rem 0.8rem', borderRadius: 20,
                            border: `1px solid ${filterStatus === s ? '#6366f1' : '#e2e8f0'}`,
                            background: filterStatus === s ? '#eef2ff' : '#fff',
                            color: filterStatus === s ? '#4f46e5' : '#64748b',
                            fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                        }}
                    >
                        {s === 'all' ? 'Todos' : s === 'active' ? '🟢 Activos' : s === 'expired' ? '🔴 Expirados' : '⬛ Revocados'}
                        {' '}
                        <span style={{ opacity: 0.6 }}>
                            ({tokens.filter(t => s === 'all' ? true : t.status === s).length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Lista */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                    <p style={{ marginTop: 8, fontSize: '0.85rem' }}>Cargando…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '2.5rem',
                    background: '#fff', borderRadius: 12,
                    border: '1px solid #e2e8f0', color: '#94a3b8',
                }}>
                    <Users size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>
                        {filterStatus === 'all' ? 'No hay tokens creados. Usa "Nuevo acceso" para comenzar.' : `No hay tokens ${filterStatus === 'active' ? 'activos' : filterStatus === 'expired' ? 'expirados' : 'revocados'}.`}
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(tok => (
                        <TokenRow
                            key={tok.id}
                            tok={tok}
                            onRevoke={handleRevoke}
                            onCopy={handleCopy}
                            copiedId={copiedId}
                        />
                    ))}
                </div>
            )}

            {/* Info de seguridad */}
            <div style={{
                marginTop: '1.5rem',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 10, padding: '0.85rem 1rem',
                fontSize: '0.72rem', color: '#64748b',
                display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
                <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: 1 }} color="#6366f1" />
                <div>
                    Los tokens son criptográficamente seguros (256 bits). El cliente accede exclusivamente a los datos
                    de su expediente o contrato según los permisos otorgados. El acceso expira automáticamente
                    según el TTL configurado. Los datos sensibles nunca se exponen públicamente.
                </div>
            </div>
        </div>
    );
};
