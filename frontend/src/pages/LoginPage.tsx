import React, { useState } from 'react';
import { Key, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { AxiosError } from 'axios';

export default function LoginPage(): React.ReactElement {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: string }>;
      const message = axiosErr.response?.data?.error ?? 'Login failed. Please check your credentials.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base relative overflow-hidden">
      {/* Background orbs */}
      <div className="hero-orb w-96 h-96 bg-primary/10 -top-20 -left-20" />
      <div className="hero-orb w-80 h-80 bg-secondary/8 bottom-0 right-0" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% -30%, rgba(124,106,247,0.18), transparent)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse-slow" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/10 rounded-2xl" />
            <Key className="w-7 h-7 text-primary relative z-10" />
          </div>
          <h1 className="text-2xl font-bold text-text mb-1">
            Key<span className="gradient-text">Vault</span>
          </h1>
          <p className="text-text-muted text-sm">Your private credential manager</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-surface p-6"
          style={{
            background: 'linear-gradient(160deg, rgba(20,20,43,0.9) 0%, rgba(13,13,31,0.95) 100%)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                Master Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your master password"
                  required
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
            </div>

            <button
              type="submit"
              className="btn-primary w-full py-2.5 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Unlocking…
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Unlock Vault
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-2 mt-5 text-text-dim">
          <ShieldCheck className="w-3.5 h-3.5" />
          <p className="text-xs">
            End-to-end encrypted · 5 attempts before lockout
          </p>
        </div>
      </div>
    </div>
  );
}
