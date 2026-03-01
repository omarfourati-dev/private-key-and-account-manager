import React, { useState } from 'react';
import { Lock, Eye, EyeOff, LogOut } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-base">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-warning/20 rounded-2xl mb-4">
            <Lock className="w-8 h-8 text-warning" />
          </div>
          <h2 className="text-2xl font-bold text-text mb-1">Vault Locked</h2>
          <p className="text-text-muted text-sm">{user?.email}</p>
        </div>

        <div className="card">
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Master Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="Enter your master password"
                  required
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full py-2.5" disabled={isLoading}>
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" />
              ) : (
                'Unlock'
              )}
            </button>
          </form>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 mx-auto mt-4 text-sm text-text-muted hover:text-text transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
