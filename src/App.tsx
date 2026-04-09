import { useState, useEffect } from 'react';
import type { User } from './core/user.types.ts';
import { authService } from './core/auth.service.ts';
import './assets/styles/global.css';

import { LoginView } from './modules/iam/LoginView.tsx';
import { MainLayout } from './ui/layouts/MainLayout.tsx';
import { DashboardView } from './modules/dashboard/DashboardView.tsx';
import { DocumentListView } from './modules/documents/DocumentListView.tsx';
import { LawyerListView } from './modules/legal-team/LawyerListView.tsx';
import { ComplianceView } from './modules/compliance/ComplianceView.tsx';
import { ContractListView } from './modules/contracts/ContractListView.tsx';
import { RiskMatrixView } from './modules/compliance/RiskMatrixView.tsx';
import { UserListView } from './modules/iam/UserListView.tsx';
import { ExpedienteListView } from './modules/expedientes/ExpedienteListView.tsx';
import { RgpdConsentBanner } from './modules/shared/RgpdConsentBanner.tsx';
import { SecurityReminderOverlay } from './modules/shared/SecurityReminderOverlay.tsx';
import { AdminSettingsView } from './modules/shared/AdminSettingsView.tsx';
import { ParametersView } from './modules/parameters/ParametersView.tsx';
import { FlowsAdminView } from './modules/flows/FlowsAdminView.tsx';
import { rgpdService } from './core/rgpd.service.ts';
import { ExternalSignView } from './modules/contracts/ExternalSignView.tsx';
import { HonorariosView } from './modules/honorarios/HonorariosView.tsx';
import { CalendarView } from './modules/calendar/CalendarView.tsx';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [rgpdAccepted, setRgpdAccepted] = useState(false); // false = mostrar banner por defecto si no hay prueba
  const [showSecurityReminder, setShowSecurityReminder] = useState(true); // Siempre true al iniciar sesión/recargar
  const [externalToken, setExternalToken] = useState<string | null>(null);

  useEffect(() => {
    // 1. Detectar si viene de un Enlace Externo (Pestaña c5)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('sign_token');
    if (token) {
        setExternalToken(token);
    }

    // 2. Sincronizar sesión: valida el token de Supabase y refresca el perfil
    //    Esto previene el bug de datos vacíos cuando el localStorage está desactualizado
    const init = async () => {
      const cachedUser = authService.getCurrentUser();
      if (cachedUser) {
        setUser(cachedUser);
        rgpdService.hasConsent(cachedUser.id).then(has => setRgpdAccepted(has));

        // Resync silencioso en segundo plano para actualizar organizationId si cambió
        authService.syncSession().then(freshUser => {
          if (freshUser) setUser(freshUser);
          else {
            // Sesión expirada: forzar logout limpio
            setUser(null);
          }
        });
      } else {
        // Sin caché: intentar recuperar sesión activa de Supabase
        const freshUser = await authService.syncSession();
        if (freshUser) {
          setUser(freshUser);
          rgpdService.hasConsent(freshUser.id).then(has => setRgpdAccepted(has));
        }
      }
      setLoading(false);
    };

    init();
  }, []);

  const handleLogin = async (u: User) => {
    setUser(u);
    setCurrentView('dashboard');
    setShowSecurityReminder(true); // Forzar que aparezca al logearse manualmente
    // Verificar consentimiento RGPD en cada login
    const hasConsent = await rgpdService.hasConsent(u.id);
    setRgpdAccepted(hasConsent);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading) return <div className="loading">Cargando Sistema LegalTech...</div>;

  // RENDERIZADO PRIORITARIO: Portal de Firma Externa (Sin Login)
  if (externalToken) {
    return <ExternalSignView token={externalToken} />;
  }

  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  // Mostrar banner RGPD (Solo si no hay consentimiento registrado en BD)
  // Mostrar banner detallado (Fase 2) si tiene sesión pero no ha aceptado la política v1.0
  if (user && !rgpdAccepted) {
    return <RgpdConsentBanner user={user} onAccepted={() => setRgpdAccepted(true)} />;
  }

  // Mostrar aviso de SEGURO DE SESIÓN (Siempre al entrar, pero volátil)
  if (user && rgpdAccepted && showSecurityReminder) {
    return <SecurityReminderOverlay userName={user.name} onDismiss={() => setShowSecurityReminder(false)} />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':  return <DashboardView user={user} />;
      case 'documents':  return <DocumentListView user={user} />;
      case 'contracts':  return <ContractListView />;
      case 'compliance': return <ComplianceView />;
      case 'risks':      return <RiskMatrixView />;
      case 'lawyers':    return <LawyerListView />;
      case 'judicial':   return <ExpedienteListView />;
      case 'users':      return <UserListView />;
      case 'parameters': return <ParametersView />;
      case 'flows':      return <FlowsAdminView />;
      case 'settings':   return <AdminSettingsView />;
      case 'honorarios': return <HonorariosView />;
      case 'calendar':   return <CalendarView />;
      default:           return <div className="premium-card" style={{ padding: '2rem' }}><h2>Vista no encontrada: {currentView}</h2></div>;
    }
  };

  return (
    <MainLayout
      user={user}
      onLogout={handleLogout}
      currentView={currentView}
      onChangeView={setCurrentView}
    >
      {renderContent()}
    </MainLayout>
  );
}

export default App;
