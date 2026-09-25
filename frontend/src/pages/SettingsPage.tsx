import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Shield, Clock, Sun, Moon, LogOut, Trash2, Download, Upload, Plus, Edit2, X, Check, Smartphone, ClipboardCopy, Monitor, Tablet } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useEntries } from '../hooks/useEntries';
import { useCategories } from '../hooks/useCategories';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import ImportWizard from '../components/ImportWizard';
import type { Category, Locale } from '../types';
import { useT, SUPPORTED_LOCALES } from '../i18n';

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  ipAddress: string | null;
  isCurrent: boolean;
  device: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  browser: string;
  os: string;
}



export default function SettingsPage(): React.ReactElement {
  const { settings, user, updateSettings, logout } = useAuth();
  const { t } = useT();
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
        <h1 className="text-2xl font-bold text-text">{t('settings.title')}</h1>
        <p className="text-text-muted text-sm mt-1">{t('settings.subtitle')}</p>
      </div>

      <AccountSection user={user} />
      <AutoLockSection settings={settings} onUpdate={updateSettings} />
      <ClipboardSection settings={settings} onUpdate={updateSettings} />
      <ThemeSection settings={settings} onUpdate={updateSettings} />
      <LanguageSection settings={settings} onUpdate={updateSettings} />
      <CategorySection categories={categories} onCreateCategory={createCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory} />
      <DataSection entries={entries} fetchEntries={fetchEntries} reEncryptAllEntries={reEncryptAllEntries} />
      <SessionsSection sessions={sessions} onRevoke={async (id) => {
        try {
          await api.delete(`/auth/sessions/${id}`);
          setSessions(prev => prev.filter(s => s.id !== id));
          toast.success(t('settings.saved'));
        } catch {
          toast.error(t('common.error'));
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
  const { t } = useT();
  const { entries } = useEntries();
  const { reEncryptAllEntries } = useEntries();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('settings.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    try {
      const reEncryptedEntries = entries.length > 0
        ? await reEncryptAllEntries(entries, masterPassword!, newPassword)
        : [];

      await api.put('/auth/password', { currentPassword, newPassword, reEncryptedEntries });
      toast.success(t('settings.saved'));
      setShowChangePassword(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SettingCard title={t('settings.account')}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-text">{user?.email}</p>
          <p className="text-xs text-text-muted">{t('settings.signedInUser')}</p>
        </div>
        <button
          onClick={() => setShowChangePassword(v => !v)}
          className="btn-secondary text-sm"
        >
          <Shield className="w-4 h-4" />
          {t('settings.changePassword')}
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
              placeholder={t('settings.currentPassword')}
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
              placeholder={t('settings.newPassword')}
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
            placeholder={t('settings.confirmPassword')}
            required
          />

          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
              {isLoading ? <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" /> : t('settings.changePassword')}
            </button>
            <button type="button" onClick={() => setShowChangePassword(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
          </div>
        </form>
      )}
    </SettingCard>
  );
}

function AutoLockSection({ settings, onUpdate }: { settings: { autoLockMins: number } | null; onUpdate: (s: { autoLockMins: number }) => Promise<void> }) {
  const { t } = useT();
  const options = [
    { value: 5, label: '5 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 0, label: t('settings.off') },
  ];

  return (
    <SettingCard title={t('settings.autoLock')}>
      <div className="grid grid-cols-4 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onUpdate({ autoLockMins: opt.value }).then(() => toast.success(t('settings.saved')))}
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

function ClipboardSection({
  settings,
  onUpdate,
}: {
  settings: { clipboardClearSecs: number } | null;
  onUpdate: (s: { clipboardClearSecs: number }) => Promise<void>;
}) {
  const { t } = useT();
  const options = [
    { value: 10, label: '10 s' },
    { value: 20, label: '20 s' },
    { value: 30, label: '30 s' },
    { value: 60, label: '60 s' },
    { value: 0, label: t('settings.off') },
  ];
  const current = settings?.clipboardClearSecs ?? 30;

  return (
    <SettingCard title={t('settings.clipboard')}>
      <p className="text-xs text-text-muted -mt-2">{t('settings.clipboardHint')}</p>
      <div className="grid grid-cols-5 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onUpdate({ clipboardClearSecs: opt.value }).then(() => toast.success(t('settings.saved')))}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl text-sm transition-all ${
              current === opt.value
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-surface text-text-muted hover:text-text border border-transparent'
            }`}
          >
            <ClipboardCopy className="w-4 h-4" />
            <span className="text-xs font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-text-dim">{t('settings.clipboardIosHint')}</p>
    </SettingCard>
  );
}

function ThemeSection({ settings, onUpdate }: { settings: { theme: string } | null; onUpdate: (s: { theme: 'dark' | 'light' }) => Promise<void> }) {
  const { t } = useT();
  return (
    <SettingCard title={t('settings.appearance')}>
      <div className="grid grid-cols-2 gap-2">
        {([
          { value: 'dark', label: t('settings.dark'), Icon: Moon },
          { value: 'light', label: t('settings.light'), Icon: Sun },
        ] as const).map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => onUpdate({ theme: value }).then(() => toast.success(t('settings.saved')))}
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

function LanguageSection({
  settings,
  onUpdate,
}: {
  settings: { locale: Locale } | null;
  onUpdate: (s: { locale: Locale }) => Promise<void>;
}) {
  const { t } = useT();
  const labels: Record<Locale, string> = { de: 'Deutsch', en: 'English' };
  const current = settings?.locale ?? 'de';

  return (
    <SettingCard title={t('settings.language')}>
      <div className="grid grid-cols-2 gap-2">
        {SUPPORTED_LOCALES.map(locale => (
          <button
            key={locale}
            onClick={() => onUpdate({ locale }).then(() => toast.success(t('settings.saved')))}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all border ${
              current === locale
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-surface text-text-muted hover:text-text border-transparent'
            }`}
          >
            {labels[locale]}
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
  const { t } = useT();
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
    <SettingCard title={t('settings.categories')}>
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="color"
          value={newColor}
          onChange={e => setNewColor(e.target.value)}
          className="w-10 h-9 rounded-lg border-0 bg-surface cursor-pointer"
          title={t('settings.categoryColor')}
        />
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="input flex-1"
          placeholder={t('settings.newCategory')}
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
          <p className="text-sm text-text-muted text-center py-4">{t('settings.noCategories')}</p>
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
  const { t } = useT();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
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
      toast.success(t('settings.exportDone'));
    } catch {
      toast.error(t('settings.exportFailed'));
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
      toast.success(t('settings.importDone'));
    } catch {
      toast.error(t('settings.importFailed'));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAllData = async () => {
    try {
      await api.delete('/settings/data');
      await fetchEntries();
      toast.success(t('settings.dataDeleted'));
      setShowDeleteConfirm(false);
    } catch {
      toast.error(t('common.error'));
    }
  };

  void entries;
  void reEncryptAllEntries;
  void masterPassword;

  return (
    <SettingCard title={t('settings.dataManagement')}>
      <div className="flex gap-3 flex-wrap">
        <button onClick={handleExport} className="btn-secondary">
          <Download className="w-4 h-4" />
          {t('settings.exportEncrypted')}
        </button>

        <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
          <Upload className="w-4 h-4" />
          {t('settings.import')}
        </button>

        <button onClick={() => setShowImportWizard(true)} className="btn-secondary">
          <Smartphone className="w-4 h-4" />
          {t('settings.importExternal')}
        </button>

        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      </div>

      {showImportWizard && (
        <ImportWizard
          onClose={() => setShowImportWizard(false)}
          onDone={() => { void fetchEntries(); }}
        />
      )}

      {!showDeleteConfirm ? (
        <button onClick={() => setShowDeleteConfirm(true)} className="btn-danger text-sm">
          <Trash2 className="w-4 h-4" />
          {t('settings.deleteAllData')}
        </button>
      ) : (
        <div className="p-3 bg-error/10 border border-error/30 rounded-lg space-y-3">
          <p className="text-sm text-text">{t('settings.deleteAllConfirm')}</p>
          <div className="flex gap-2">
            <button onClick={handleDeleteAllData} className="btn-danger flex-1 text-sm">{t('settings.deleteEverything')}</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 text-sm">{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </SettingCard>
  );
}

const DEVICE_ICONS = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
  unknown: Monitor,
} as const;

function SessionsSection({ sessions, onRevoke }: { sessions: Session[]; onRevoke: (id: string) => Promise<void> }) {
  const { t, formatRelative } = useT();
  return (
    <SettingCard title={t('settings.sessions')}>
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-2">{t('settings.noSessions')}</p>
        ) : (
          sessions.map((session) => {
            const DeviceIcon = DEVICE_ICONS[session.device];
            return (
              <div
                key={session.id}
                className={`flex items-center gap-3 p-3 bg-surface rounded-xl ${
                  session.isCurrent ? 'ring-1 ring-primary/30' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-base-100 flex items-center justify-center flex-shrink-0">
                  <DeviceIcon className="w-4 h-4 text-text-muted" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text flex items-center gap-2 flex-wrap">
                    <span className="truncate">{session.browser} · {session.os}</span>
                    {session.isCurrent && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        {t('settings.thisDevice')}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t('settings.activeAgo', { time: formatRelative(session.lastActiveAt) })}
                    {session.ipAddress && <> · {session.ipAddress}</>}
                  </p>
                  <p className="text-xs text-text-dim">
                    {t('settings.signedInAgo', { time: formatRelative(session.createdAt) })}
                  </p>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => onRevoke(session.id)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
                    title={t('settings.revokeSession')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      <p className="text-xs text-text-dim">{t('settings.ipHint')}</p>
    </SettingCard>
  );
}

function DangerSection({ onLogout }: { onLogout: () => Promise<void> }) {
  const { t } = useT();
  return (
    <SettingCard title={t('settings.session')}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text">{t('settings.signOutAllTitle')}</p>
          <p className="text-xs text-text-muted">{t('settings.signOutAllHint')}</p>
        </div>
        <button
          onClick={async () => {
            try {
              await api.post('/auth/logout-all');
              await onLogout();
            } catch {
              toast.error(t('common.error'));
            }
          }}
          className="btn-danger text-sm"
        >
          <LogOut className="w-4 h-4" />
          {t('settings.signOutAll')}
        </button>
      </div>

      <div className="text-xs text-text-muted pt-2 border-t border-surface">
        {t('settings.version', { version: '1.0.0' })}
      </div>
    </SettingCard>
  );
}
