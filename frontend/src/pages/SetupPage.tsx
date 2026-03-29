import React, { useState } from 'react';
import { Key, Eye, EyeOff, ShieldCheck, Lock, Cpu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

export default function SetupPage(): React.ReactElement {
  const { setup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsLoading(true);
    try {
      await setup(email, password);
      toast.success('Vault created successfully!');
    } catch {
      toast.error('Setup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Lock, text: 'AES-256-GCM client-side encryption' },
    { icon: ShieldCheck, text: 'Master password never leaves your device' },
    { icon: Cpu, text: 'PBKDF2 with 100,000 iterations' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base relative overflow-hidden">
      {/* Background */}
      <div className="hero-orb w-96 h-96 bg-primary/10 -top-20 -right-10" />
      <div className="hero-orb w-72 h-72 bg-secondary/8 bottom-0 left-0" />
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'radial-gradient(ellipse 100% 80% at 50% -30%, rgba(124,106,247,0.15), transparent)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 relative">
            <div className="absolute inset-0 bg-primary/20 rounded-2xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-secondary/10 rounded-2xl" />
            <Key className="w-7 h-7 text-primary relative z-10" />
          </div>
          <h1 className="text-2xl font-bold text-text mb-1">
            Welcome to Key<span className="gradient-text">Vault</span>
          </h1>
          <p className="text-text-muted text-sm">Create your secure vault to get started</p>
        </div>

        {/* Main card */}
        <div
          className="rounded-2xl border border-surface p-6 space-y-5"
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
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
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

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
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

            <button
              type="submit"
              className="btn-primary w-full py-2.5"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating vault…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Create Secure Vault
                </>
              )}
            </button>
          </form>

          {/* Security features */}
          <div className="pt-4 border-t border-surface space-y-2">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-xs text-text-dim">
                <Icon className="w-3.5 h-3.5 text-success/70 flex-shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
