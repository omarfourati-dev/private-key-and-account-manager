import React, { useState } from 'react';
import { Lock, Eye, EyeOff, LogOut, Key } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function LockScreen(): React.ReactElement {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await unlock(password);
    } catch {
      toast.error('Incorrect password. Please try again.');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base relative overflow-hidden">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 60% at 50% -20%, rgba(124,106,247,0.12), transparent)',
        }}
      />

      <div className="w-full max-w-xs relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 relative">
            <div className="absolute inset-0 bg-warning/15 rounded-2xl" />
            <Lock className="w-6 h-6 text-warning relative z-10" />
          </div>
          <h2 className="text-xl font-bold text-text mb-1">Vault Locked</h2>
          <p className="text-text-muted text-sm">{user?.email}</p>
        </div>

        <div
          className="rounded-2xl border border-surface p-5"
          style={{
            background: 'linear-gradient(160deg, rgba(20,20,43,0.9) 0%, rgba(13,13,31,0.95) 100%)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="Master password"
                required
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button type="submit" className="btn-primary w-full py-2.5" disabled={isLoading}>
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Unlock Vault
                </>
              )}
            </button>
          </form>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 mx-auto mt-4 text-xs text-text-muted hover:text-text transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out instead
        </button>
      </div>
    </div>
  );
}
