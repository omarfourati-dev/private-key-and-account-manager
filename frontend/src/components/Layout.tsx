import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Key, Settings, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps): React.ReactElement {
  const { lock, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-base">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 border-b border-surface bg-base/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-text">
            <Key className="w-5 h-5 text-primary" />
            <span className="hidden sm:inline">Key Manager</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              to="/"
              className={`btn-ghost px-3 py-1.5 text-sm ${location.pathname === '/' ? 'text-text bg-surface' : ''}`}
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">Vault</span>
            </Link>

            <Link
              to="/settings"
              className={`btn-ghost px-3 py-1.5 text-sm ${location.pathname === '/settings' ? 'text-text bg-surface' : ''}`}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            <button onClick={lock} className="btn-ghost px-3 py-1.5 text-sm" title="Lock vault">
              <Lock className="w-4 h-4" />
            </button>

            <button onClick={logout} className="btn-ghost px-3 py-1.5 text-sm" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
