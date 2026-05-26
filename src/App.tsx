import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import type { User } from './core/user.types.ts';
import { authService } from './core/auth.service.ts';
import './assets/styles/global.css';

import { LoginView }              from './modules/iam/LoginView.tsx';
import { MainLayout }             from './ui/layouts/MainLayout.tsx';
import { DashboardView }          from './modules/dashboard/DashboardView.tsx';
import { DocumentListView }       from './modules/documents/DocumentListView.tsx';
import { LawyerListView }         from './modules/legal-team/LawyerListView.tsx';
import { ComplianceView }         from './modules/compliance/ComplianceView.tsx';
import { ContractListView }       from './modules/contracts/ContractListView.tsx';
import { RiskMatrixView }         from './modules/compliance/RiskMatrixView.tsx';
import { UserListView }           from './modules/iam/UserListView.tsx';
import { ExpedienteListView }     from './modules/expedientes/ExpedienteListView.tsx';
import { RgpdConsentBanner }      from './modules/shared/RgpdConsentBanner.tsx';
import { SecurityReminderOverlay } from './modules/shared/SecurityReminderOverlay.tsx';
import { AdminSettingsView }      from './modules/shared/AdminSettingsView.tsx';
import { RATView }                from './modules/compliance/RATView.tsx';
import { ParametersView }         from './modules/parameters/ParametersView.tsx';
import { FlowsAdminView }         from './modules/flows/FlowsAdminView.tsx';
import { ExternalSignView }       from './modules/contracts/ExternalSignView.tsx';
import { ClientPortalView }       from './modules/contracts/ClientPortalView.tsx';
import { HonorariosView }         from './modules/honorarios/HonorariosView.tsx';
import { LiveTimerWidget }        from './modules/honorarios/LiveTimerWidget.tsx';
import { CalendarView }           from './modules/calendar/CalendarView.tsx';
import { rgpdService }            from './core/rgpd.service.ts';

// ─── Rutas de la aplicación ──────────────────────────────────────────────────
// Una URL real por módulo — compartibles, historial de navegador funcional

export const ROUTES = {
    LOGIN:       '/login',
    SIGN:        '/sign',           // Portal firma externa (sin login)
    PORTAL:      '/portal',         // Portal de cliente con acceso por token (sin login)
    DASHBOARD:   '/dashboard',
    DOCUMENTS:   '/documentos',
    CONTRACTS:   '/contratos',
    COMPLIANCE:  '/compliance',
    RISKS:       '/riesgos',
    RAT:         '/compliance/rat', // RGPD Art. 30 — Registro de Actividades
    LAWYERS:     '/equipo',
    JUDICIAL:    '/expedientes',
    HONORARIOS:  '/honorarios',
    CALENDAR:    '/calendario',
    USERS:       '/usuarios',
    PARAMETERS:  '/parametros',
    FLOWS:       '/flujos',
    SETTINGS:    '/configuracion',
} as const;

// ─── Guards ──────────────────────────────────────────────────────────────────

function RequireAuth({ user, children }: { user: User | null; children: React.ReactNode }) {
    const location = useLocation();
    if (!user) return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
    return <>{children}</>;
}

// ─── Shell autenticado ───────────────────────────────────────────────────────

interface AppShellProps {
    user: User;
    onLogout: () => void;
    rgpdAccepted: boolean;
    onRgpdAccepted: () => void;
    showSecurityReminder: boolean;
    onDismissReminder: () => void;
}

function AppShell({
    user, onLogout, rgpdAccepted, onRgpdAccepted, showSecurityReminder, onDismissReminder,
}: AppShellProps) {
    const navigate  = useNavigate();
    const location  = useLocation();

    // Mapeo URL → id de vista para el MainLayout legado (sin refactor completo del layout)
    const urlToView: Record<string, string> = {
        [ROUTES.DASHBOARD]:  'dashboard',
        [ROUTES.DOCUMENTS]:  'documents',
        [ROUTES.CONTRACTS]:  'contracts',
        [ROUTES.COMPLIANCE]: 'compliance',
        [ROUTES.RISKS]:      'risks',
        [ROUTES.RAT]:        'rat',
        [ROUTES.LAWYERS]:    'lawyers',
        [ROUTES.JUDICIAL]:   'judicial',
        [ROUTES.HONORARIOS]: 'honorarios',
        [ROUTES.CALENDAR]:   'calendar',
        [ROUTES.USERS]:      'users',
        [ROUTES.PARAMETERS]: 'parameters',
        [ROUTES.FLOWS]:      'flows',
        [ROUTES.SETTINGS]:   'settings',
    };

    const viewToUrl: Record<string, string> = Object.fromEntries(
        Object.entries(urlToView).map(([url, view]) => [view, url])
    );

    const currentView = urlToView[location.pathname] ?? 'dashboard';

    const handleChangeView = (view: string) => {
        const url = viewToUrl[view] ?? ROUTES.DASHBOARD;
        navigate(url);
    };

    // Pantallas previas al layout principal
    if (!rgpdAccepted) {
        return <RgpdConsentBanner user={user} onAccepted={onRgpdAccepted} />;
    }
    if (showSecurityReminder) {
        return <SecurityReminderOverlay userName={user.name} onDismiss={onDismissReminder} />;
    }

    return (
        <MainLayout user={user} onLogout={onLogout} currentView={currentView} onChangeView={handleChangeView}>
            {/* Widget flotante de time tracking — visible en todas las rutas */}
            <LiveTimerWidget />
            <Routes>
                <Route path={ROUTES.DASHBOARD}  element={<DashboardView user={user} />} />
                <Route path={ROUTES.DOCUMENTS}  element={<DocumentListView user={user} />} />
                <Route path={ROUTES.CONTRACTS}  element={<ContractListView />} />
                <Route path={ROUTES.COMPLIANCE} element={<ComplianceView />} />
                <Route path={ROUTES.RISKS}      element={<RiskMatrixView />} />
                <Route path={ROUTES.RAT}        element={<RATView />} />
                <Route path={ROUTES.LAWYERS}    element={<LawyerListView />} />
                <Route path={ROUTES.JUDICIAL}   element={<ExpedienteListView />} />
                <Route path={ROUTES.HONORARIOS} element={<HonorariosView />} />
                <Route path={ROUTES.CALENDAR}   element={<CalendarView />} />
                <Route path={ROUTES.USERS}      element={<UserListView />} />
                <Route path={ROUTES.PARAMETERS} element={<ParametersView />} />
                <Route path={ROUTES.FLOWS}      element={<FlowsAdminView />} />
                <Route path={ROUTES.SETTINGS}   element={<AdminSettingsView />} />
                {/* Redirige raíz y rutas desconocidas al dashboard */}
                <Route path="/"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                <Route path="*"  element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            </Routes>
        </MainLayout>
    );
}

// ─── App raíz ────────────────────────────────────────────────────────────────

function AppInner() {
    const [user, setUser]                           = useState<User | null>(null);
    const [loading, setLoading]                     = useState(true);
    const [rgpdAccepted, setRgpdAccepted]           = useState(false);
    const [showSecurityReminder, setShowSecurityReminder] = useState(true);

    const navigate  = useNavigate();
    const location  = useLocation();

    useEffect(() => {
        const init = async () => {
            // Portal de firma externa — no requiere login
            if (location.pathname.startsWith(ROUTES.SIGN)) {
                setLoading(false);
                return;
            }

            const cachedUser = authService.getCurrentUser();
            if (cachedUser) {
                setUser(cachedUser);
                rgpdService.hasConsent(cachedUser.id).then(has => setRgpdAccepted(has));
                // Resync silencioso en background
                authService.syncSession().then(freshUser => {
                    if (freshUser) setUser(freshUser);
                    else { setUser(null); navigate(ROUTES.LOGIN, { replace: true }); }
                });
            } else {
                const freshUser = await authService.syncSession();
                if (freshUser) {
                    setUser(freshUser);
                    rgpdService.hasConsent(freshUser.id).then(has => setRgpdAccepted(has));
                }
            }
            setLoading(false);
        };
        init();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleLogin = async (u: User) => {
        setUser(u);
        setShowSecurityReminder(true);
        const hasConsent = await rgpdService.hasConsent(u.id);
        setRgpdAccepted(hasConsent);
        // Redirigir a la ruta de origen si viene de un redirect de auth guard
        const from = (location.state as any)?.from?.pathname ?? ROUTES.DASHBOARD;
        navigate(from, { replace: true });
    };

    const handleLogout = () => {
        authService.logout();
        setUser(null);
        navigate(ROUTES.LOGIN, { replace: true });
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#172554' }}>
                <div style={{ color: '#93c5fd', fontSize: '1rem', fontWeight: 600 }}>Cargando Sistema LegalTech...</div>
            </div>
        );
    }

    return (
        <Routes>
            {/* Portal firma externa — sin autenticación */}
            <Route path={`${ROUTES.SIGN}/*`} element={<ExternalSignView token={new URLSearchParams(location.search).get('sign_token') ?? ''} />} />

            {/* Portal de cliente con acceso por token — sin autenticación */}
            <Route path={`${ROUTES.PORTAL}/:token`} element={<ClientPortalView />} />

            {/* Login */}
            <Route path={ROUTES.LOGIN} element={
                user ? <Navigate to={ROUTES.DASHBOARD} replace /> : <LoginView onLogin={handleLogin} />
            } />

            {/* Todas las rutas protegidas */}
            <Route path="/*" element={
                <RequireAuth user={user}>
                    <AppShell
                        user={user!}
                        onLogout={handleLogout}
                        rgpdAccepted={rgpdAccepted}
                        onRgpdAccepted={() => setRgpdAccepted(true)}
                        showSecurityReminder={showSecurityReminder}
                        onDismissReminder={() => setShowSecurityReminder(false)}
                    />
                </RequireAuth>
            } />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppInner />
        </BrowserRouter>
    );
}

export default App;
