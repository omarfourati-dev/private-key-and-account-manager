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

  const googleHref = '/api/auth/google';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base relative overflow-hidden">
      {/* Atmospheric orbs */}
      <div
        className="hero-orb"
        style={{ width: 520, height: 520, background: 'rgba(113,94,235,0.12)', top: -160, left: -120 }}
      />
      <div
        className="hero-orb"
        style={{ width: 380, height: 380, background: 'rgba(56,189,248,0.07)', bottom: -80, right: -60 }}
      />
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 100% 80% at 50% -30%, rgba(124,106,247,0.18), transparent)' }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative">
            <div
              className="absolute inset-0 rounded-2xl animate-glow-pulse"
              style={{ background: 'rgba(113,94,235,0.25)' }}
            />
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(113,94,235,0.4) 0%, rgba(56,189,248,0.15) 100%)' }}
            />
            <Key className="w-7 h-7 text-primary relative z-10" />
          </div>
          <h1 className="text-2xl font-bold text-text mb-1">
            Key<span className="gradient-text">Vault</span>
          </h1>
          <p className="text-sm" style={{ color: '#737486' }}>Your private credential manager</p>
        </div>

        {/* Glass card */}
        <div className="glass p-6">
          {/* OAuth buttons */}
          <div className="space-y-2.5 mb-5">
            <a
              href={googleHref}
              className="flex items-center justify-center gap-3 w-full h-12 rounded-xl text-text text-sm font-medium transition-colors hover:opacity-90"
              style={{ background: 'rgba(34,36,57,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </a>

          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-xs" style={{ color: '#737486' }}>or sign in with password</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#737486' }}>
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
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: '#ada3ff' }}>
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
                  Unlocking&hellip;
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
        <div className="flex items-center justify-center gap-2 mt-5" style={{ color: '#737486' }}>
          <ShieldCheck className="w-3.5 h-3.5" />
          <p className="text-xs">End-to-end encrypted &middot; 5 attempts before lockout</p>
        </div>
      </div>
    </div>
  );
}
