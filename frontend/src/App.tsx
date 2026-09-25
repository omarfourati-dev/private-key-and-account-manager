import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import SetupPage from './pages/SetupPage';
import LoginPage from './pages/LoginPage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import InvitePage from './pages/InvitePage';
import LockScreen from './components/LockScreen';
import Dashboard from './pages/Dashboard';
import SettingsPage from './pages/SettingsPage';
import DownloadsPage from './pages/DownloadsPage';
import AdminPage from './pages/AdminPage';
import Layout from './components/Layout';
import { ImpressumPage, DatenschutzPage } from './pages/LegalPages';
import { pageCategoryFor, trackPageview } from './utils/analytics';
import { I18nProvider, detectLocale } from './i18n';

export default function App(): React.ReactElement {
  const { settings } = useAuth();
  // Bis die Einstellungen geladen sind, entscheidet die Browsersprache
  const locale = settings?.locale ?? detectLocale();

  // Apply theme
  useEffect(() => {
    const theme = settings?.theme ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [settings?.theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nProvider locale={locale}>
      <AppRoutes />
    </I18nProvider>
  );
}

function AppRoutes(): React.ReactElement {
  const { user, isAuthenticated, isLocked, isSetupComplete } = useAuth();

  // Analytics: nur neutrale Seitenkategorie, nie echter Pfad oder Inhalte
  const { pathname } = useLocation();
  const pageCategory = pageCategoryFor({
    pathname,
    isSetupComplete,
    hasUser: Boolean(user),
    isLocked,
    isAuthenticated,
  });
  useEffect(() => {
    trackPageview(pageCategory);
  }, [pageCategory]);

  // Rechtstexte sind immer erreichbar – unabhängig von Anmeldung, Sperre oder Setup
  if (pathname === '/impressum') return <ImpressumPage />;
  if (pathname === '/datenschutz') return <DatenschutzPage />;

  if (window.location.pathname === '/auth/callback') {
    return <OAuthCallbackPage />;
  }

  if (window.location.pathname.startsWith('/invite/')) {
    return <InvitePage />;
  }

  if (isSetupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSetupComplete) {
    return <SetupPage />;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        {user.isAdmin && <Route path="/admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
