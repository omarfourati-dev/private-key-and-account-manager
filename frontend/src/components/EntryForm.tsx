import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Wand2, ChevronDown } from 'lucide-react';
import PasswordGenerator from './PasswordGenerator';
import type { Entry, EntryFormData, Category } from '../types';
import { decryptData } from '../utils/crypto';
import { parseOtpAuth, generateTotp, formatTotpCode, TotpError, type TotpErrorCode } from '../utils/totp';
import toast from 'react-hot-toast';
import { useT } from '../i18n';

/** Fehlercode des TOTP-Parsers → i18n-Schlüssel */
const otpErrorKey = (code: TotpErrorCode): string => `totp.error.${code}`;

const ICONS = ['🔑', '🔐', '🛡️', '⚡', '🌐', '🚀', '💻', '📱', '☁️', '🏦', '💳', '🔒', '🤖', '📊', '🎯', '🗝️', '🔓', '📋', '🧩', '🌍'];

interface EntryFormProps {
  entry?: Entry;
  categories: Category[];
  masterPassword: string;
  onSubmit: (data: EntryFormData) => Promise<void>;
  onClose: () => void;
}

export default function EntryForm({ entry, categories, masterPassword, onSubmit, onClose }: EntryFormProps): React.ReactElement {
  const isEditing = !!entry;
  const { t } = useT();

  const [formData, setFormData] = useState<EntryFormData>({
    type: 'API_KEY',
    name: '',
    icon: '🔑',
    service: '',
    username: '',
    url: '',
    note: '',
    apiKey: '',
    password: '',
    otpAuth: '',
    categoryIds: [],
  });

  const [showSecret, setShowSecret] = useState(false);
  // Auto-open generator for new account entries so password can be generated immediately
  const [showGenerator, setShowGenerator] = useState(!entry && formData.type === 'ACCOUNT');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [otpAuthError, setOtpAuthError] = useState<string | null>(null);

  // Live-Validierung des 2FA-Schlüssels mit Vorschau des aktuellen Codes
  useEffect(() => {
    const raw = formData.otpAuth?.trim();
    if (!raw) {
      setOtpPreview(null);
      setOtpAuthError(null);
      return;
    }

    let cancelled = false;
    try {
      const config = parseOtpAuth(raw);
      setOtpAuthError(null);
      void generateTotp(config).then(code => {
        if (!cancelled) setOtpPreview(formatTotpCode(code));
      });
    } catch (err) {
      setOtpPreview(null);
      setOtpAuthError(
        err instanceof TotpError ? t(otpErrorKey(err.code)) : t('common.error')
      );
    }
    return () => { cancelled = true; };
  }, [formData.otpAuth, t]);

  useEffect(() => {
    if (entry) {
      setIsLoadingExisting(true);
      decryptData<{ apiKey?: string; password?: string; otpAuth?: string }>(entry.encryptedData, masterPassword)
        .then(decrypted => {
          setFormData({
            type: entry.type,
            name: entry.name,
            icon: entry.icon,
            service: entry.service ?? '',
            username: entry.username ?? '',
            url: entry.url ?? '',
            note: entry.note ?? '',
            expiresAt: entry.expiresAt ?? undefined,
            apiKey: decrypted.apiKey ?? '',
            password: decrypted.password ?? '',
            otpAuth: decrypted.otpAuth ?? '',
            categoryIds: entry.categories.map(c => c.id),
          });
        })
        .catch(() => toast.error(t('entry.decryptFailed')))
        .finally(() => setIsLoadingExisting(false));
    }
  }, [entry, masterPassword]);

  const update = (field: keyof EntryFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Auto-open generator when switching to account type with no password yet
    if (field === 'type' && value === 'ACCOUNT' && !formData.password && !isEditing) {
      setShowGenerator(true);
    }
    if (field === 'type' && value === 'API_KEY') {
      setShowGenerator(false);
    }
  };

  const toggleCategory = (id: string) => {
    setFormData(prev => ({
      ...prev,
      categoryIds: prev.categoryIds?.includes(id)
        ? prev.categoryIds.filter(c => c !== id)
        : [...(prev.categoryIds ?? []), id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const secretValue = formData.type === 'API_KEY' ? formData.apiKey : formData.password;
    if (!secretValue && !isEditing) {
      toast.error(formData.type === 'API_KEY' ? t('form.missingApiKey') : t('form.missingPassword'));
      return;
    }
    if (otpAuthError) {
      toast.error(`${t('totp.label')}: ${otpAuthError}`);
      return;
    }
    setIsLoading(true);
    try {
      await onSubmit(formData);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <div className="modal-overlay">
        <div className="modal-content max-w-lg flex items-center justify-center p-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg">
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-surface-200 rounded-full" />
        </div>

        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-surface bg-base-100/95 backdrop-blur-sm rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="text-base font-semibold text-text">
            {isEditing ? t('form.editEntry') : t('form.newEntry')}
          </h2>
          {/* Large close button for mobile */}
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface hover:bg-surface-100 transition-colors text-text-muted hover:text-text"
            aria-label={t('form.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 72px)' }}>
          {/* Type selector — full height buttons for easy tap */}
          <div className="flex gap-2">
            {(['API_KEY', 'ACCOUNT'] as const).map(entryType => (
              <button
                key={entryType}
                type="button"
                onClick={() => update('type', entryType)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  formData.type === entryType
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'bg-surface text-text-muted hover:text-text border border-transparent'
                }`}
              >
                {entryType === 'API_KEY' ? `🔑 ${t('form.typeApiKey')}` : `👤 ${t('form.typeAccount')}`}
              </button>
            ))}
          </div>

          {/* Icon Picker + Name */}
          <div className="flex gap-2 items-start">
            {/* Icon picker button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPicker(v => !v)}
                className="w-12 h-12 flex items-center justify-center bg-surface border border-surface-200 rounded-xl text-xl hover:bg-surface-100 transition-colors relative"
                title={t('form.chooseIcon')}
              >
                {formData.icon}
                <ChevronDown className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 text-text-dim" />
              </button>

              {showIconPicker && (
                <div
                  className="absolute top-14 left-0 z-20 bg-base-100 border border-surface rounded-2xl p-2 shadow-modal animate-scale-in"
                  style={{ width: 196 }}
                >
                  <div className="grid grid-cols-5 gap-1">
                    {ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => { update('icon', icon); setShowIconPicker(false); }}
                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-lg transition-colors ${
                          formData.icon === icon ? 'bg-primary/20' : 'hover:bg-surface'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1">
              <input
                type="text"
                value={formData.name}
                onChange={e => update('name', e.target.value)}
                className="input h-12"
                placeholder={t('form.name')}
                required
                maxLength={255}
              />
            </div>
          </div>

          {/* Service */}
          <input
            type="text"
            value={formData.service}
            onChange={e => update('service', e.target.value)}
            className="input"
            placeholder={formData.type === 'API_KEY' ? t('form.serviceApiKey') : t('form.serviceAccount')}
            maxLength={255}
          />

          {/* Username (account only) */}
          {formData.type === 'ACCOUNT' && (
            <input
              type="text"
              value={formData.username}
              onChange={e => update('username', e.target.value)}
              className="input"
              placeholder={t('form.username')}
              autoComplete="off"
              maxLength={255}
            />
          )}

          {/* Secret field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                {formData.type === 'API_KEY' ? t('form.apiKey') : t('form.password')}
              </span>
              <button
                type="button"
                onClick={() => setShowGenerator(v => !v)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors ${
                  showGenerator
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-muted hover:text-primary hover:bg-primary/10'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                {showGenerator ? t('form.hideGenerator') : t('form.generate')}
              </button>
            </div>

            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={formData.type === 'API_KEY' ? formData.apiKey : formData.password}
                onChange={e => update(formData.type === 'API_KEY' ? 'apiKey' : 'password', e.target.value)}
                className="input pr-12 font-mono text-sm"
                placeholder={formData.type === 'API_KEY' ? t('form.apiKeyPlaceholder') : t('form.passwordPlaceholder')}
                autoComplete="new-password"
                maxLength={4096}
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
                title={showSecret ? t('entry.hide') : t('entry.show')}
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {showGenerator && (
              <PasswordGenerator
                onUse={pwd => {
                  update(formData.type === 'API_KEY' ? 'apiKey' : 'password', pwd);
                  setShowGenerator(false);
                  setShowSecret(true);
                }}
              />
            )}
          </div>

          {/* 2FA-Schlüssel (nur für Konten) */}
          {formData.type === 'ACCOUNT' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                {t('totp.label')}
              </label>
              <input
                type="text"
                value={formData.otpAuth ?? ''}
                onChange={e => update('otpAuth', e.target.value)}
                className={`input font-mono text-xs ${
                  otpAuthError ? 'border-error/50 focus:ring-error/40' : ''
                }`}
                placeholder={t('totp.placeholder')}
                autoComplete="off"
                maxLength={2048}
                aria-invalid={!!otpAuthError}
                aria-describedby={otpAuthError ? 'otpauth-error' : undefined}
              />
              {otpAuthError ? (
                <p id="otpauth-error" className="text-xs text-error mt-1.5">{otpAuthError}</p>
              ) : otpPreview ? (
                <p className="text-xs text-success mt-1.5 font-mono tracking-widest">
                  {t('totp.preview', { code: otpPreview })}
                </p>
              ) : (
                <p className="text-xs text-text-dim mt-1.5">
                  {t('totp.hint')}
                </p>
              )}
            </div>
          )}

          {/* URL */}
          <input
            type="url"
            value={formData.url}
            onChange={e => update('url', e.target.value)}
            className="input"
            placeholder={t('form.url')}
            maxLength={2048}
          />

          {/* Expiry (API key only) */}
          {formData.type === 'API_KEY' && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">{t('form.expiresAt')}</label>
              <input
                type="datetime-local"
                value={formData.expiresAt ?? ''}
                onChange={e => update('expiresAt', e.target.value || undefined)}
                className="input"
              />
            </div>
          )}

          {/* Note */}
          <textarea
            value={formData.note}
            onChange={e => update('note', e.target.value)}
            className="input resize-none"
            placeholder={t('form.note')}
            rows={3}
            maxLength={2000}
          />

          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">{t('form.categories')}</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const selected = formData.categoryIds?.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        selected ? 'ring-1' : 'opacity-60 hover:opacity-90'
                      }`}
                      style={{
                        backgroundColor: `${cat.color}18`,
                        color: cat.color,
                        borderColor: selected ? cat.color : 'transparent',
                      }}
                    >
                      {selected ? '✓ ' : ''}{cat.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit buttons — full width, 48px height */}
          <div className="flex gap-3 pt-2 pb-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 h-12">
              {t('form.cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1 h-12" disabled={isLoading}>
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isEditing ? t('form.save') : t('form.create')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
