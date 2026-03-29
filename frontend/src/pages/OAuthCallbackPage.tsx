import React, { useEffect, useState } from 'react';
import { Key, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

type PageState = 'loading' | 'vault_setup' | 'vault_unlock' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  provider_not_configured: 'This sign-in provider is not configured. Please use email/password.',
  account_exists: 'An account already exists. Please sign in with your original method.',
  invalid_state: 'Invalid OAuth state. Please try again.',
  oauth_failed: 'Sign-in failed. Please try again.',
  no_email: 'No email returned from Apple. Please allow email sharing.',
};

export default function OAuthCallbackPage(): React.ReactElement {
  const { loginWithOAuthToken, unlock } = useAuth();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [vaultPassword, setVaultPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');
    const newUser = params.get('isNewUser') === 'true';

    if (error) {
      setErrorMsg(ERROR_MESSAGES[error] ?? 'Authentication failed. Please try again.');
      setPageState('error');
      return;
    }

    if (!token) {
      setErrorMsg('No authentication token received.');
      setPageState('error');
      return;
    }

    loginWithOAuthToken(token)
      .then(() => {
        // Clear token from URL without reload
        window.history.replaceState({}, '', '/');
        setPageState(newUser ? 'vault_setup' : 'vault_unlock');
      })
      .catch(() => {
        setErrorMsg('Failed to process authentication. Please try again.');
        setPageState('error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVaultSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vaultPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (vaultPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsSubmitting(true);
    try {
      // For OAuth new users, we use the unlock function since they are already authenticated.
      // We set the vault password which is used only for client-side encryption.
      await unlock(vaultPassword);
      toast.success('Vault created! Welcome to KeyVault.');
    } catch {
      toast.error('Failed to set up vault. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVaultUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await unlock(vaultPassword);
    } catch {
      toast.error('Wrong vault password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-base">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-text-muted text-sm">Completing sign-in…</p>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-base">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-error/10">
            <AlertCircle className="w-7 h-7 text-error" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text mb-2">Sign-in Failed</h1>
            <p className="text-text-muted text-sm">{errorMsg}</p>
          </div>
          <a
            href="/"
            className="btn-primary inline-flex px-6 py-2.5"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-base relative overflow-hidden">
      {/* Background orbs */}
      <div className="hero-orb w-96 h-96 bg-primary/10 -top-20 -left-20" />
      <div className="hero-orb w-80 h-80 bg-secondary/8 bottom-0 right-0" />

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
          <p className="text-text-muted text-sm">
            {pageState === 'vault_setup'
              ? 'Set a vault password to encrypt your data'
              : 'Enter your vault password to unlock'}
          </p>
        </div>

        <div
          className="rounded-2xl border border-surface p-6"
          style={{
            background: 'linear-gradient(160deg, rgba(20,20,43,0.9) 0%, rgba(13,13,31,0.95) 100%)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
          }}
        >
          <form
            onSubmit={pageState === 'vault_setup' ? handleVaultSetup : handleVaultUnlock}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">
                {pageState === 'vault_setup' ? 'Create Vault Password' : 'Vault Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={vaultPassword}
                  onChange={e => setVaultPassword(e.target.value)}
                  className="input pr-10"
                  placeholder={pageState === 'vault_setup' ? 'Min. 8 characters' : 'Enter vault password'}
                  required
                  minLength={8}
                  autoComplete={pageState === 'vault_setup' ? 'new-password' : 'current-password'}
                  autoFocus
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

            {pageState === 'vault_setup' && (
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
            )}

            <button
              type="submit"
              className="btn-primary w-full py-2.5 mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {pageState === 'vault_setup' ? 'Creating vault…' : 'Unlocking…'}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {pageState === 'vault_setup' ? 'Create Vault' : 'Unlock Vault'}
                </>
              )}
            </button>
          </form>

          {pageState === 'vault_setup' && (
            <p className="text-xs text-text-dim text-center mt-4">
              This password encrypts your data locally. It cannot be recovered.
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-5 text-text-dim">
          <ShieldCheck className="w-3.5 h-3.5" />
          <p className="text-xs">AES-256-GCM · Encrypted on your device</p>
        </div>
      </div>
    </div>
  );
}
