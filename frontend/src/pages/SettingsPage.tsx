import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, Clock, Sun, Moon, LogOut, Trash2, Download, Upload, Plus, Edit2, X, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useEntries } from '../hooks/useEntries';
import { useCategories } from '../hooks/useCategories';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import type { Category } from '../types';

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
}

export default function SettingsPage(): React.ReactElement {
  const { settings, user, updateSettings, logout } = useAuth();
  const { entries, fetchEntries, reEncryptAllEntries } = useEntries();
  const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } = useCategories();
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    void fetchEntries();
    void fetchCategories();
    api.get<{ sessions: Session[] }>('/auth/sessions')
      .then(({ data }) => setSessions(data.sessions))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Manage your vault preferences</p>
      </div>

      <AccountSection user={user} />
      <AutoLockSection settings={settings} onUpdate={updateSettings} />
      <ThemeSection settings={settings} onUpdate={updateSettings} />
      <CategorySection categories={categories} onCreateCategory={createCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory} />
      <DataSection entries={entries} fetchEntries={fetchEntries} reEncryptAllEntries={reEncryptAllEntries} />
      <SessionsSection sessions={sessions} onRevoke={async (id) => {
        try {
          await api.delete(`/auth/sessions/${id}`);
          setSessions(prev => prev.filter(s => s.id !== id));
          toast.success('Session revoked');
        } catch {
          toast.error('Failed to revoke session');
        }
      }} />
      <DangerSection onLogout={logout} />
    </div>
  );
}

function SettingCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-4">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {children}
    </div>
  );
}

function AccountSection({ user }: { user: { email: string } | null }) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { masterPassword } = useAuth();
  const { entries } = useEntries();
  const { reEncryptAllEntries } = useEntries();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const reEncryptedEntries = entries.length > 0
        ? await reEncryptAllEntries(entries, masterPassword!, newPassword)
        : [];

      await api.put('/auth/password', { currentPassword, newPassword, reEncryptedEntries });
      toast.success('Password changed. Please log in again.');
      setShowChangePassword(false);
    } catch {
      toast.error('Failed to change password. Check your current password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SettingCard title="Account">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text">{user?.email}</p>
          <p className="text-xs text-text-muted">Signed in user</p>
        </div>
        <button
          onClick={() => setShowChangePassword(v => !v)}
          className="btn-secondary text-sm"
        >
          <Shield className="w-4 h-4" />
          Change Password
        </button>
      </div>

      {showChangePassword && (
        <form onSubmit={handleChangePassword} className="space-y-3 p-3 bg-surface rounded-lg">
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="input pr-10"
              placeholder="Current password"
              required
            />
            <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="input pr-10"
              placeholder="New password (min. 8 characters)"
              required
              minLength={8}
            />
            <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <input
            type={showNew ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="input"
            placeholder="Confirm new password"
            required
          />

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
              {isLoading ? <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" /> : 'Change Password'}
            </button>
            <button type="button" onClick={() => setShowChangePassword(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </form>
      )}
    </SettingCard>
  );
}

function AutoLockSection({ settings, onUpdate }: { settings: { autoLockMins: number } | null; onUpdate: (s: { autoLockMins: number }) => Promise<void> }) {
  const options = [
    { value: 5, label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 0, label: 'Off' },
  ];

  return (
    <SettingCard title="Auto-Lock">
      <div className="grid grid-cols-4 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onUpdate({ autoLockMins: opt.value }).then(() => toast.success('Auto-lock updated'))}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl text-sm transition-all ${
              settings?.autoLockMins === opt.value
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-surface text-text-muted hover:text-text border border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </SettingCard>
  );
}

function ThemeSection({ settings, onUpdate }: { settings: { theme: string } | null; onUpdate: (s: { theme: 'dark' | 'light' }) => Promise<void> }) {
  return (
    <SettingCard title="Appearance">
      <div className="grid grid-cols-2 gap-2">
        {([
          { value: 'dark', label: 'Dark', Icon: Moon },
          { value: 'light', label: 'Light', Icon: Sun },
        ] as const).map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => onUpdate({ theme: value }).then(() => toast.success('Theme updated'))}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border ${
              settings?.theme === value
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-surface text-text-muted hover:text-text border-transparent'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>
    </SettingCard>
  );
}

function CategorySection({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: {
  categories: Category[];
  onCreateCategory: (name: string, color?: string) => Promise<Category>;
  onUpdateCategory: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await onCreateCategory(newName.trim(), newColor);
      setNewName('');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    await onUpdateCategory(id, { name: editName.trim() });
    setEditingId(null);
  };

  return (
    <SettingCard title="Categories">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          className="w-10 h-9 rounded-lg border-0 bg-surface cursor-pointer"
          title="Category color"
        />
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="input flex-1"
          placeholder="New category name"
          maxLength={100}
        />
        <button type="submit" className="btn-primary px-3" disabled={isCreating || !newName.trim()}>
          <Plus className="w-4 h-4" />
        </button>
      </form>

      <div className="space-y-2">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-2 p-2 bg-surface rounded-xl min-h-[48px]">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />

            {editingId === cat.id ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="input flex-1 py-1.5 text-sm"
                  autoFocus
                  maxLength={100}
                />
                <button
                  onClick={() => handleEdit(cat.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-success hover:bg-success/10 transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-text">{cat.name}</span>
                {cat._count && <span className="text-xs text-text-muted">{cat._count.entries}</span>}
                <button
                  onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-100 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDeleteCategory(cat.id)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        ))}

        {categories.length === 0 && (
          <p className="text-sm text-text-muted text-center py-4">No categories yet</p>
        )}
      </div>
    </SettingCard>
  );
}

function DataSection({ entries, fetchEntries, reEncryptAllEntries }: {
  entries: ReturnType<typeof useEntries>['entries'];
  fetchEntries: ReturnType<typeof useEntries>['fetchEntries'];
  reEncryptAllEntries: ReturnType<typeof useEntries>['reEncryptAllEntries'];
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { masterPassword } = useAuth();

  const handleExport = async () => {
    try {
      const { data } = await api.get('/export', { responseType: 'blob' });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `key-manager-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await api.post('/import', { ...data, merge: true });
      await fetchEntries();
      toast.success('Import successful');
    } catch {
      toast.error('Import failed. Check file format.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAllData = async () => {
    try {
      await api.delete('/settings/data');
      await fetchEntries();
      toast.success('All data deleted');
      setShowDeleteConfirm(false);
    } catch {
      toast.error('Failed to delete data');
    }
  };

  void entries;
  void reEncryptAllEntries;
  void masterPassword;

  return (
    <SettingCard title="Data Management">
      <div className="flex gap-3 flex-wrap">
        <button onClick={handleExport} className="btn-secondary">
          <Download className="w-4 h-4" />
          Export Encrypted
        </button>

        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
          <Upload className="w-4 h-4" />
          Import
        </button>

        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      </div>

      {!showDeleteConfirm ? (
        <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger text-sm">
          <Trash2 className="w-4 h-4" />
          Delete All Data
        </button>
      ) : (
        <div className="p-3 bg-error/10 border border-error/30 rounded-lg space-y-3">
          <p className="text-sm text-text">Are you sure? This will permanently delete all entries and categories.</p>
          <div className="flex gap-2">
            <button onClick={handleDeleteAllData} className="btn-danger flex-1 text-sm">Delete Everything</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
          </div>
        </div>
      )}
    </SettingCard>
  );
}

function SessionsSection({ sessions, onRevoke }: { sessions: Session[]; onRevoke: (id: string) => Promise<void> }) {
  return (
    <SettingCard title="Active Sessions">
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-2">No other active sessions</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-2 bg-surface rounded-lg">
              <div>
                <p className="text-sm text-text">
                  Session from {new Date(session.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs text-text-muted">
                  Expires {new Date(session.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => onRevoke(session.id)}
                className="btn-ghost p-1.5 text-text-muted hover:text-error text-xs"
                title="Revoke session"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </SettingCard>
  );
}

function DangerSection({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <SettingCard title="Session">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text">Sign out of all devices</p>
          <p className="text-xs text-text-muted">Invalidates all active sessions</p>
        </div>
        <button
          onClick={async () => {
            try {
              await api.post('/auth/logout-all');
              await onLogout();
            } catch {
              toast.error('Failed to sign out all sessions');
            }
          }}
          className="btn-danger text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign Out All
        </button>
      </div>

      <div className="text-xs text-text-muted pt-2 border-t border-surface">
        Private Key Manager v1.0.0
      </div>
    </SettingCard>
  );
}
