import React, { useState } from 'react';
import { Lock, Eye, EyeOff, LogOut, Key, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function LockScreen(): React.ReactElement {
  const { user, unlock, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // OAuth-only users with no vault key need to create a master password
  const isCreatingPassword = user?.hasPassword === false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingPassword) {
      if (password.length < 8) {
        toast.error('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }
    setIsLoading(true);
    try {
      await unlock(password);
    } catch {
      toast.error(isCreatingPassword ? 'Failed to set up vault. Please try again.' : 'Incorrect password. Please try again.');
      setPassword('');
      setConfirmPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base relative overflow-hidden">
      <div
        className="hero-orb"
        style={{ width: 480, height: 480, background: 'rgba(113,94,235,0.1)', top: -140, left: -100 }}
      />
      <div
        className="hero-orb"
        style={{ width: 320, height: 320, background: 'rgba(56,189,248,0.06)', bottom: -60, right: -40 }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 100% 60% at 50% -20%, rgba(124,106,247,0.14), transparent)' }}
      />

      <div className="w-full max-w-xs relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 relative">
            <div
              className="absolute inset-0 rounded-2xl animate-glow-pulse"
              style={{ background: isCreatingPassword ? 'rgba(124,106,247,0.2)' : 'rgba(251,191,36,0.2)' }}
            />
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: isCreatingPassword ? 'rgba(124,106,247,0.12)' : 'rgba(251,191,36,0.12)' }}
            />
            {isCreatingPassword
              ? <ShieldCheck className="w-6 h-6 text-primary relative z-10" />
              : <Lock className="w-6 h-6 text-warning relative z-10" />}
          </div>
          <h2 className="text-xl font-bold text-text mb-1">
            {isCreatingPassword ? 'Create Master Password' : 'Vault Locked'}
          </h2>
          <p className="text-sm" style={{ color: '#737486' }}>
            {isCreatingPassword
              ? 'Set a password to encrypt your vault'
              : user?.email}
          </p>
        </div>

        <div className="glass p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#ada3ff' }}>
                {isCreatingPassword ? 'New Master Password' : 'Master Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder={isCreatingPassword ? 'Min. 8 characters' : 'Enter master password'}
                  required
                  minLength={isCreatingPassword ? 8 : undefined}
                  autoFocus
                  autoComplete={isCreatingPassword ? 'new-password' : 'current-password'}
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
            </div>

            {isCreatingPassword && (
              <div>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#ada3ff' }}>
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                />
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={isLoading}>
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isCreatingPassword ? (
                <><ShieldCheck className="w-4 h-4" />Set Up Vault</>
              ) : (
                <><Key className="w-4 h-4" />Unlock Vault</>
              )}
            </button>
          </form>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 mx-auto mt-4 text-xs transition-colors"
          style={{ color: '#737486' }}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out instead
        </button>
      </div>
    </div>
  );
}
