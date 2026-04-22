import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Key, Settings, Lock, LogOut, LayoutDashboard, Download, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface LayoutProps {
  children: React.ReactNode;
}

const baseNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Vault' },
  { to: '/downloads', icon: Download, label: 'Apps' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }: LayoutProps): React.ReactElement {
  const { lock, logout, user } = useAuth();
  const location = useLocation();

  const navItems = [
    ...baseNavItems,
    ...(user?.isAdmin ? [{ to: '/admin', icon: Crown, label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-base">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(ellipse 90% 60% at 50% -10%, rgba(124,106,247,0.12), transparent)',
        }}
      />

      {/* Top Nav */}
      <header className="nav-bg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
              <Key className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-text hidden sm:block">
              Key<span className="text-primary">Vault</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-text-muted hover:text-text hover:bg-surface'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={lock}
              className="btn-ghost p-2 rounded-lg"
              title="Lock vault"
            >
              <Lock className="w-4 h-4" />
            </button>
            <button
              onClick={logout}
              className="btn-ghost p-2 rounded-lg"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 py-6 pb-24 sm:pb-6">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 safe-bottom nav-bg">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all duration-150 ${
                  active ? 'text-primary' : 'text-text-dim'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-primary/15' : ''}`}>
                  <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}

          <button
            onClick={lock}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-text-dim"
          >
            <div className="p-1.5 rounded-lg">
              <Lock style={{ width: 18, height: 18 }} />
            </div>
            <span className="text-[10px] font-medium">Lock</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
