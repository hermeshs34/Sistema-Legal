import React, { useState } from 'react';
import {
    Users, FileText, LayoutDashboard, Menu, LogOut,
    ShieldCheck, Scale, FileSignature, Gavel, Settings,
    SlidersHorizontal, GitBranch, Wallet, CalendarDays,
    BookOpen, ClipboardList, UserCog
} from 'lucide-react';
import type { User, UserRole } from '../../core/user.types.ts';
import { ROL_META } from '../../core/user.types.ts';

interface MainLayoutProps {
    user: User;
    children: React.ReactNode;
    onLogout: () => void;
    currentView: string;
    onChangeView: (view: string) => void;
}

// ── Roles disponibles (todos) ─────────────────────────────────────────────────
const ALL_ROLES: UserRole[] = [
    'consultor_general', 'abogado_senior', 'abogado_junior',
    'consultor_principal', 'aprendiz',
    'compliance_officer', 'auditor_externo', 'gerente_firma',
];

// ── Definición del menú lateral ───────────────────────────────────────────────
// roles: qué roles pueden VER ese ítem
// group: separador visual opcional

interface SidebarItem {
    id:     string;
    label:  string;
    icon:   React.ElementType;
    roles:  UserRole[];
    group?: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
    // ── Principal ────────────────────────────────────────────────────────────
    {
        id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard,
        roles: ALL_ROLES,
        group: 'Principal',
    },

    // ── Documentos y Contratos ───────────────────────────────────────────────
    {
        id: 'documents', label: 'Gestión Documental', icon: FileText,
        roles: ['consultor_general','abogado_senior','abogado_junior','consultor_principal','aprendiz','auditor_externo','gerente_firma'],
        group: 'Documentos',
    },
    {
        id: 'contracts', label: 'Contratos', icon: FileSignature,
        roles: ['consultor_general','abogado_senior','auditor_externo','gerente_firma'],
    },
    {
        id: 'calendar', label: 'Calendario Legal', icon: CalendarDays,
        roles: ['consultor_general','abogado_senior','abogado_junior','consultor_principal','gerente_firma'],
    },

    // ── Expedientes y Equipo ─────────────────────────────────────────────────
    {
        id: 'judicial', label: 'Módulo Judicial', icon: Gavel,
        roles: ['consultor_general','abogado_senior','abogado_junior','consultor_principal','auditor_externo','gerente_firma'],
        group: 'Gestión Legal',
    },
    {
        id: 'lawyers', label: 'Directorio Legal', icon: Users,
        roles: ['consultor_general','abogado_senior','consultor_principal','gerente_firma'],
    },
    {
        id: 'honorarios', label: 'Honorarios', icon: Wallet,
        roles: ['consultor_general','abogado_senior','auditor_externo','gerente_firma'],
    },

    // ── Compliance y Riesgo ──────────────────────────────────────────────────
    {
        id: 'compliance', label: 'Compliance', icon: ShieldCheck,
        roles: ['consultor_general','abogado_senior','consultor_principal','compliance_officer','auditor_externo','gerente_firma'],
        group: 'Compliance & Riesgo',
    },
    {
        id: 'rat', label: 'RAT — RGPD Art. 30', icon: BookOpen,
        roles: ['consultor_general','compliance_officer','auditor_externo','gerente_firma'],
    },
    {
        id: 'risks', label: 'Gestión de Riesgo', icon: Scale,
        roles: ['consultor_general','abogado_senior','consultor_principal','compliance_officer','auditor_externo','gerente_firma'],
    },

    // ── Administración ───────────────────────────────────────────────────────
    {
        id: 'users', label: 'Usuarios', icon: UserCog,
        roles: ['consultor_general'],
        group: 'Administración',
    },
    {
        id: 'parameters', label: 'Base Paramétrica', icon: SlidersHorizontal,
        roles: ['consultor_general'],
    },
    {
        id: 'flows', label: 'Flujos BPM', icon: GitBranch,
        roles: ['consultor_general'],
    },
    {
        id: 'settings', label: 'Admin / IA', icon: Settings,
        roles: ['consultor_general'],
    },
];

// ── Componente ────────────────────────────────────────────────────────────────

export const MainLayout: React.FC<MainLayoutProps> = ({
    user, children, onLogout, currentView, onChangeView
}) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Filtrar ítems según el rol del usuario
    const filteredItems = SIDEBAR_ITEMS.filter(item => item.roles.includes(user.role));

    // Agrupar para separadores visuales
    const groups: { group: string; items: SidebarItem[] }[] = [];
    let currentGroup = '';
    filteredItems.forEach(item => {
        if (item.group && item.group !== currentGroup) {
            currentGroup = item.group;
            groups.push({ group: item.group, items: [item] });
        } else if (groups.length === 0) {
            groups.push({ group: '', items: [item] });
        } else {
            groups[groups.length - 1].items.push(item);
        }
    });

    const roleMeta = ROL_META[user.role];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>

            {/* ── Sidebar ───────────────────────────────────────────────────── */}
            <aside style={{
                width: isSidebarOpen ? '260px' : '0',
                backgroundColor: 'var(--legal-900)',
                color: 'white',
                transition: 'width 0.3s ease',
                overflow: 'hidden',
                position: 'fixed',
                height: '100vh',
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Logo */}
                <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                    <div style={{ background: '#ffffff', borderRadius: '14px', padding: '12px 16px', marginBottom: '0.6rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <img src="/hermes-ai-logo.svg" alt="HermesAI Solutions" style={{ width: '100%', display: 'block' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center' }}>
                        Plataforma LegalDoc VE
                    </div>
                </div>

                {/* Navegación */}
                <nav className="sidebar-nav" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', overflowX: 'hidden', gap: '0.125rem' }}>
                    {groups.map(({ group, items }) => (
                        <div key={group || '_root'}>
                            {/* Separador de grupo */}
                            {group && (
                                <div style={{
                                    fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.35)',
                                    textTransform: 'uppercase', letterSpacing: '0.12em',
                                    padding: '0.75rem 1rem 0.35rem', marginTop: '0.25rem',
                                }}>
                                    {group}
                                </div>
                            )}
                            {/* Ítems del grupo */}
                            {items.map(item => {
                                const isActive = currentView === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => onChangeView(item.id)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.6rem 1rem', width: '100%',
                                            background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                                            borderTop: 'none',
                                            borderRight: 'none',
                                            borderBottom: 'none',
                                            borderLeft: isActive ? '3px solid #60a5fa' : '3px solid transparent',
                                            borderRadius: '8px',
                                            color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                                            cursor: 'pointer', textAlign: 'left',
                                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                                            fontSize: '0.86rem', fontWeight: isActive ? 700 : 500,
                                        }}
                                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                        title={item.label}
                                    >
                                        <item.icon size={18} style={{ flexShrink: 0 }} />
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Perfil en sidebar */}
                <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                            background: roleMeta?.color ?? '#1d4ed8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, fontSize: '0.9rem', color: 'white',
                        }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user.name}
                            </div>
                            <div style={{
                                fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {roleMeta?.label ?? user.role}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ── Área principal ────────────────────────────────────────────── */}
            <div style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Header */}
                <header style={{
                    height: '64px', backgroundColor: 'white',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 2rem', position: 'sticky', top: 0, zIndex: 10,
                }}>
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}>
                        <Menu size={24} color="var(--legal-900)" />
                    </button>

                    {/* Módulo activo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {(() => {
                            const item = SIDEBAR_ITEMS.find(i => i.id === currentView);
                            if (!item) return null;
                            const Icon = item.icon;
                            return <><Icon size={16} /><span style={{ fontWeight: 600 }}>{item.label}</span></>;
                        })()}
                    </div>

                    {/* Usuario */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--legal-950)' }}>
                                {user.name}
                            </div>
                            <div style={{
                                fontSize: '0.65rem', fontWeight: 700, padding: '1px 8px', borderRadius: '999px',
                                background: `${roleMeta?.color ?? '#1d4ed8'}18`,
                                color: roleMeta?.color ?? '#1d4ed8',
                                display: 'inline-block',
                            }}>
                                {roleMeta?.label ?? user.role}
                                {roleMeta?.mfaRequired && ' 🔐'}
                            </div>
                        </div>
                        <div style={{
                            width: '38px', height: '38px', borderRadius: '50%',
                            background: roleMeta?.color ?? '#1d4ed8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 800, color: 'white', fontSize: '1rem',
                        }}>
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <button onClick={onLogout} title="Cerrar Sesión"
                            style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {/* Contenido */}
                <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    {children}
                </main>
            </div>
        </div>
    );
};
