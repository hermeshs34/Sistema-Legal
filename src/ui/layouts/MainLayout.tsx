import React, { useState } from 'react';
import {
    Users,
    FileText,
    LayoutDashboard,
    Menu,
    LogOut,
    ShieldCheck,
    Scale,
    FileSignature,
    Gavel,
    Settings,
    SlidersHorizontal,
    GitBranch,
    Wallet,
    CalendarDays
} from 'lucide-react';
import type { User, UserRole } from '../../core/user.types.ts';

interface MainLayoutProps {
    user: User;
    children: React.ReactNode;
    onLogout: () => void;
    currentView: string;
    onChangeView: (view: string) => void;
}

const SIDEBAR_ITEMS = [
    { id: 'dashboard', label: 'Dashboard',          icon: LayoutDashboard, roles: ['consultor_general', 'abogado_senior', 'abogado_junior', 'consultor_principal', 'aprendiz'] },
    { id: 'documents', label: 'Gestión Documental', icon: FileText,         roles: ['consultor_general', 'abogado_senior', 'abogado_junior', 'consultor_principal', 'aprendiz'] },
    { id: 'calendar',  label: 'Calendario',          icon: CalendarDays,     roles: ['consultor_general', 'abogado_senior', 'abogado_junior', 'consultor_principal'] },
    { id: 'contracts', label: 'Contratos',           icon: FileSignature,    roles: ['consultor_general', 'abogado_senior'] },
    { id: 'honorarios', label: 'Honorarios',          icon: Wallet,           roles: ['consultor_general', 'abogado_senior'] },
    { id: 'judicial',  label: 'Módulo Judicial',     icon: Gavel,            roles: ['consultor_general', 'abogado_senior', 'consultor_principal'] },
    { id: 'compliance',label: 'Compliance',           icon: ShieldCheck,      roles: ['consultor_general', 'abogado_senior', 'consultor_principal'] },
    { id: 'risks',     label: 'Gestión de Riesgo',   icon: Scale,            roles: ['consultor_general', 'abogado_senior', 'consultor_principal'] },
    { id: 'lawyers',   label: 'Directorio Legal',    icon: Users,            roles: ['consultor_general', 'abogado_senior', 'consultor_principal'] },
    { id: 'users',      label: 'Usuarios',             icon: Users,               roles: ['consultor_general'] },
    { id: 'parameters', label: 'Base Paramétrica',      icon: SlidersHorizontal,   roles: ['consultor_general'] },
    { id: 'flows',      label: 'Flujos BPM',           icon: GitBranch,           roles: ['consultor_general'] },
    { id: 'settings',   label: 'Admin / IA',            icon: Settings,            roles: ['consultor_general'] },
];

export const MainLayout: React.FC<MainLayoutProps> = ({ user, children, onLogout, currentView, onChangeView }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const getRoleLabel = (role: UserRole) => {
        return role.replace(/_/g, ' ').toUpperCase();
    };

    const filteredItems = SIDEBAR_ITEMS.filter(item => item.roles.includes(user.role));

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
            {/* Sidebar */}
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
                flexDirection: 'column'
            }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
                    <div style={{ background: '#ffffff', borderRadius: '14px', padding: '12px 16px', marginBottom: '0.6rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <img src="/hermes-ai-logo.svg" alt="HermesAI Solutions" style={{ width: '100%', display: 'block' }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center' }}>Plataforma LegalDoc VE</div>
                </div>

                <nav className="sidebar-nav" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                    {filteredItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onChangeView(item.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.65rem 1rem',
                                width: '100%',
                                background: currentView === item.id ? 'var(--legal-800)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.2s',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                            onMouseEnter={(e) => { if (currentView !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                            onMouseLeave={(e) => { if (currentView !== item.id) e.currentTarget.style.background = 'transparent' }}
                        >
                            <item.icon size={20} />
                            <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{item.label}</span>
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content Wrapper */}
            <div style={{
                flex: 1,
                marginLeft: isSidebarOpen ? '260px' : '0',
                transition: 'margin-left 0.3s ease',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Header */}
                <header style={{
                    height: '64px',
                    backgroundColor: 'white',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 2rem',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10
                }}>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                        <Menu size={24} color="var(--legal-900)" />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--legal-950)' }}>{user.name}</div>
                            <div className="status-badge status-active" style={{ fontSize: '0.65rem', display: 'inline-block' }}>
                                {getRoleLabel(user.role)}
                            </div>
                        </div>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--legal-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontWeight: 600, color: 'var(--legal-700)' }}>{user.name.charAt(0)}</span>
                        </div>
                        <button
                            onClick={onLogout}
                            style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--risk-high)' }}
                            title="Cerrar Sesión"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
                    {children}
                </main>
            </div>
        </div>
    );
};
