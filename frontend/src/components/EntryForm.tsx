import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Wand2 } from 'lucide-react';
import PasswordGenerator from './PasswordGenerator';
import type { Entry, EntryFormData, Category } from '../types';
import { decryptData } from '../utils/crypto';
import toast from 'react-hot-toast';

const ICONS = ['🔑', '🔐', '🛡️', '⚡', '🌐', '🚀', '💻', '📱', '☁️', '🏦', '💳', '🔒', '🤖', '📊', '🎯'];

interface EntryFormProps {
  entry?: Entry;
  categories: Category[];
  masterPassword: string;
  onSubmit: (data: EntryFormData) => Promise<void>;
  onClose: () => void;
}

export default function EntryForm({ entry, categories, masterPassword, onSubmit, onClose }: EntryFormProps): React.ReactElement {
  const isEditing = !!entry;

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
    categoryIds: [],
  });

  const [showSecret, setShowSecret] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  useEffect(() => {
    if (entry) {
      setIsLoadingExisting(true);
      decryptData<{ apiKey?: string; password?: string }>(entry.encryptedData, masterPassword)
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
            categoryIds: entry.categories.map(c => c.id),
          });
        })
        .catch(() => toast.error('Failed to decrypt entry data'))
        .finally(() => setIsLoadingExisting(false));
    }
  }, [entry, masterPassword]);

  const update = (field: keyof EntryFormData, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      toast.error(`Please enter a ${formData.type === 'API_KEY' ? 'API key' : 'password'}`);
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(formData);
    } catch {
      toast.error('Failed to save entry');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingExisting) {
    return (
      <div className="modal-overlay">
        <div className="modal-content max-w-lg flex items-center justify-center p-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface">
          <h2 className="text-lg font-semibold text-text">
            {isEditing ? 'Edit Entry' : 'New Entry'}
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type selector */}
          <div className="flex gap-2">
            {(['API_KEY', 'ACCOUNT'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => update('type', t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  formData.type === t ? 'bg-primary text-base' : 'bg-surface text-text-muted hover:text-text'
                }`}
              >
                {t === 'API_KEY' ? '🔑 API Key' : '👤 Account'}
              </button>
            ))}
          </div>

          {/* Icon & Name */}
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={formData.icon}
                onChange={e => update('icon', e.target.value)}
                className="input w-16 text-center text-xl appearance-none cursor-pointer"
                title="Choose icon"
              >
                {ICONS.map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={formData.name}
                onChange={e => update('name', e.target.value)}
                className="input"
                placeholder="Name / Label (e.g. OpenAI Production)"
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
            placeholder={formData.type === 'API_KEY' ? 'Service / Provider (e.g. OpenAI)' : 'Service / Website Name'}
            maxLength={255}
          />

          {/* Username (account only) */}
          {formData.type === 'ACCOUNT' && (
            <input
              type="text"
              value={formData.username}
              onChange={e => update('username', e.target.value)}
              className="input"
              placeholder="Username / Email"
              maxLength={255}
            />
          )}

          {/* Secret field */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={formData.type === 'API_KEY' ? formData.apiKey : formData.password}
                onChange={e => update(formData.type === 'API_KEY' ? 'apiKey' : 'password', e.target.value)}
                className="input pr-20 font-mono"
                placeholder={formData.type === 'API_KEY' ? 'API Key (encrypted)' : 'Password (encrypted)'}
                maxLength={4096}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  className="text-text-muted hover:text-text p-1"
                  title={showSecret ? 'Hide' : 'Show'}
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerator(v => !v)}
                  className="text-text-muted hover:text-primary p-1"
                  title="Generate password"
                >
                  <Wand2 className="w-4 h-4" />
                </button>
              </div>
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

          {/* URL */}
          <input
            type="url"
            value={formData.url}
            onChange={e => update('url', e.target.value)}
            className="input"
            placeholder="URL / Website (optional)"
            maxLength={2048}
          />

          {/* Expiry */}
          {formData.type === 'API_KEY' && (
            <div>
              <label className="block text-xs text-text-muted mb-1">Expiration Date (optional)</label>
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
            placeholder="Notes / 2FA hints (optional)"
            rows={3}
            maxLength={2000}
          />

          {/* Categories */}
          {categories.length > 0 && (
            <div>
              <label className="block text-xs text-text-muted mb-2">Categories</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`badge py-1 px-2.5 cursor-pointer transition-all text-xs ${
                      formData.categoryIds?.includes(cat.id) ? 'ring-1' : 'opacity-50 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: `${cat.color}20`,
                      color: cat.color,
                    }}
                  >
                    {formData.categoryIds?.includes(cat.id) && '✓ '}
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-base border-t-transparent rounded-full animate-spin" />
              ) : (
                isEditing ? 'Save Changes' : 'Create Entry'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
