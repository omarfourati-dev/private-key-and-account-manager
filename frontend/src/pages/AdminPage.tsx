import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Activity, Link, Trash2, Ban, CheckCircle, Crown, Plus, Copy, X, KeyRound, Eye, EyeOff } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { stringToVaultKey, decryptAdminPrivateKey, decryptVaultKeyWithAdminKey, wrapVaultKey } from '../utils/crypto';
import toast from 'react-hot-toast';

interface AdminUser {
  id: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  googleId: string | null;
  createdAt: string;
  activeSessions: number;
  _count: { entries: number };
}

interface AdminSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  user: { id: string; email: string };
}

interface AdminInvite {
  id: string;
  token: string;
  email: string | null;
  createdAt: string;
  expiresAt: string;
  creator: { email: string };
  url: string;
}

interface Stats {
  userCount: number;
  entryCount: number;
  categoryCount: number;
  activeSessionCount: number;
}

type Tab = 'stats' | 'users' | 'sessions' | 'invites';

export default function AdminPage(): React.ReactElement {
  const { user, masterPassword } = useAuth();
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const loadStats = useCallback(async () => {
    const { data } = await api.get<Stats>('/admin/stats');
    setStats(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data } = await api.get<{ users: AdminUser[] }>('/admin/users');
    setUsers(data.users);
  }, []);

  const loadSessions = useCallback(async () => {
    const { data } = await api.get<{ sessions: AdminSession[] }>('/admin/sessions');
    setSessions(data.sessions);
  }, []);

  const loadInvites = useCallback(async () => {
    const { data } = await api.get<{ invites: AdminInvite[] }>('/admin/invites');
    setInvites(data.invites);
  }, []);

  useEffect(() => {
    setLoading(true);
    const loaders: Record<Tab, () => Promise<void>> = {
      stats: loadStats,
      users: loadUsers,
      sessions: loadSessions,
      invites: loadInvites,
    };
    loaders[tab]().finally(() => setLoading(false));
  }, [tab, loadStats, loadUsers, loadSessions, loadInvites]);

  const patchUser = async (id: string, patch: { isAdmin?: boolean; isActive?: boolean }) => {
    try {
      await api.patch(`/admin/users/${id}`, patch);
      toast.success('User updated');
      loadUsers();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Update failed';
      toast.error(msg);
    }
  };

  const deleteUser = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('User deleted');
      loadUsers();
    } catch {
      toast.error('Delete failed');
    }
  };

  const revokeSession = async (id: string) => {
    try {
      await api.delete(`/admin/sessions/${id}`);
      toast.success('Session revoked');
      loadSessions();
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post<{ invite: AdminInvite }>('/admin/invites', {
        email: inviteEmail || undefined,
      });
      toast.success('Invite created');
      setInviteEmail('');
      setShowInviteForm(false);
      await navigator.clipboard.writeText(data.invite.url);
      toast.success('Invite URL copied to clipboard');
      loadInvites();
    } catch {
      toast.error('Failed to create invite');
    }
  };

  const deleteInvite = async (id: string) => {
    try {
      await api.delete(`/admin/invites/${id}`);
      toast.success('Invite deleted');
      loadInvites();
    } catch {
      toast.error('Failed to delete invite');
    }
  };

  const copyInviteUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied to clipboard');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !masterPassword) return;
    if (resetPassword !== resetPasswordConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (resetPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setResetLoading(true);
    try {
      const { data } = await api.get<{
        adminEncryptedVaultKey: string;
        adminPrivateKeyEncrypted: string;
      }>(`/admin/users/${resetTarget.id}/recovery-data`);

      // Decrypt admin private key using admin's vault key
      const adminVaultKey = stringToVaultKey(masterPassword);
      const adminPrivateKeyJwk = await decryptAdminPrivateKey(data.adminPrivateKeyEncrypted, adminVaultKey);

      // Decrypt user's vault key using admin private key
      const userVaultKey = await decryptVaultKeyWithAdminKey(data.adminEncryptedVaultKey, adminPrivateKeyJwk);

      // Re-wrap vault key under new password
      const newEncryptedVaultKey = await wrapVaultKey(userVaultKey, resetPassword);

      await api.post(`/admin/users/${resetTarget.id}/reset-password`, {
        newPassword: resetPassword,
        newEncryptedVaultKey,
      });

      toast.success(`Password reset for ${resetTarget.email}`);
      setResetTarget(null);
      setResetPassword('');
      setResetPasswordConfirm('');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Reset failed';
      toast.error(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'stats', label: 'Overview', icon: Activity },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'sessions', label: 'Sessions', icon: Shield },
    { key: 'invites', label: 'Invites', icon: Link },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Crown className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-text">Admin Panel</h1>
          <p className="text-xs text-text-muted">Logged in as {user?.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Stats */}
      {!loading && tab === 'stats' && stats && (
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Users', value: stats.userCount, color: '#7c6af7' },
            { label: 'Total Entries', value: stats.entryCount, color: '#34d399' },
            { label: 'Categories', value: stats.categoryCount, color: '#38bdf8' },
            { label: 'Active Sessions', value: stats.activeSessionCount, color: '#f59e0b' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass p-5 rounded-2xl">
              <p className="text-xs text-text-muted mb-1">{label}</p>
              <p className="text-3xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {!loading && tab === 'users' && (
        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="glass p-4 rounded-2xl flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text truncate">{u.email}</span>
                  {u.isAdmin && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(124,106,247,0.2)', color: '#a78bfa' }}>Admin</span>
                  )}
                  {!u.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>Suspended</span>
                  )}
                  {u.googleId && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>Google</span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {u._count.entries} entries · {u.activeSessions} active sessions · joined {new Date(u.createdAt).toLocaleDateString()}
                </p>
              </div>
              {u.id !== user?.id && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => patchUser(u.id, { isAdmin: !u.isAdmin })}
                    title={u.isAdmin ? 'Remove admin' : 'Make admin'}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                  >
                    <Crown className={`w-4 h-4 ${u.isAdmin ? 'text-primary' : 'text-text-muted'}`} />
                  </button>
                  <button
                    onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                    title={u.isActive ? 'Suspend' : 'Activate'}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                  >
                    {u.isActive
                      ? <Ban className="w-4 h-4 text-text-muted" />
                      : <CheckCircle className="w-4 h-4 text-success" />}
                  </button>
                  <button
                    onClick={() => { setResetTarget(u); setResetPassword(''); setResetPasswordConfirm(''); }}
                    title="Reset password"
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                  >
                    <KeyRound className="w-4 h-4 text-text-muted" />
                  </button>
                  <button
                    onClick={() => deleteUser(u.id, u.email)}
                    title="Delete user"
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                  >
                    <Trash2 className="w-4 h-4 text-error" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Sessions */}
      {!loading && tab === 'sessions' && (
        <div className="space-y-3">
          {sessions.length === 0 && (
            <p className="text-center text-text-muted text-sm py-8">No active sessions</p>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="glass p-4 rounded-2xl flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{s.user.email}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Started {new Date(s.createdAt).toLocaleString()} · expires {new Date(s.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => revokeSession(s.id)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="Revoke session"
              >
                <X className="w-4 h-4 text-error" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invites */}
      {!loading && tab === 'invites' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowInviteForm(v => !v)} className="btn-primary px-4 py-2 flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              New Invite
            </button>
          </div>

          {showInviteForm && (
            <form onSubmit={createInvite} className="glass p-4 rounded-2xl space-y-3">
              <p className="text-sm font-medium text-text">Create Invite Link</p>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                className="input"
                placeholder="Restrict to email (optional)"
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary px-4 py-2 text-sm">Create & Copy Link</button>
                <button type="button" onClick={() => setShowInviteForm(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
              </div>
            </form>
          )}

          {invites.length === 0 && !showInviteForm && (
            <p className="text-center text-text-muted text-sm py-8">No active invites</p>
          )}
          {invites.map((inv) => (
            <div key={inv.id} className="glass p-4 rounded-2xl flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{inv.email ?? 'Open invite'}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Expires {new Date(inv.expiresAt).toLocaleDateString()} · created by {inv.creator.email}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => copyInviteUrl(inv.url)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Copy link">
                  <Copy className="w-4 h-4 text-text-muted" />
                </button>
                <button onClick={() => deleteInvite(inv.id)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Delete">
                  <Trash2 className="w-4 h-4 text-error" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Password Reset Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="glass w-full max-w-sm p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">Reset Password</h2>
              <button onClick={() => setResetTarget(null)} className="p-1 text-text-muted hover:text-text">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-text-muted">
              Resetting password for <span className="text-text font-medium">{resetTarget.email}</span>.
              Their vault entries will remain fully accessible.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">New Password</label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowResetPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wide">Confirm Password</label>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetPasswordConfirm}
                  onChange={e => setResetPasswordConfirm(e.target.value)}
                  className="input"
                  placeholder="Repeat password"
                  required
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-2" disabled={resetLoading}>
                  {resetLoading
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <KeyRound className="w-4 h-4" />}
                  {resetLoading ? 'Resetting…' : 'Reset Password'}
                </button>
                <button type="button" onClick={() => setResetTarget(null)} className="px-4 py-2 text-sm text-text-muted hover:text-text">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
