import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

export default function App(): React.ReactElement {
  const { user, isAuthenticated, isLocked, isSetupComplete, settings } = useAuth();

  // Apply theme
  useEffect(() => {
    const theme = settings?.theme ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [settings?.theme]);

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
        {user?.isAdmin && <Route path="/admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
