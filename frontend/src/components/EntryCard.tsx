import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Edit2, Trash2, ExternalLink, Clock, Tag, Key, User, Star } from 'lucide-react';
import { useClipboard } from '../hooks/useClipboard';
import TotpCode from './TotpCode';
import { safeExternalUrl } from '../utils/safeUrl';
import { useT } from '../i18n';
import type { Entry, DecryptedEntry } from '../types';
import toast from 'react-hot-toast';

interface EntryCardProps {
  entry: Entry;
  masterPassword: string;
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onDecrypt: (entry: Entry, password: string) => Promise<DecryptedEntry>;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onUsed: (id: string) => void;
}

export default function EntryCard({ entry, masterPassword, onEdit, onDelete, onDecrypt, onToggleFavorite, onUsed }: EntryCardProps): React.ReactElement {
  const { copy } = useClipboard();
  const { t, formatDate } = useT();
  const externalUrl = safeExternalUrl(entry.url);
  const [revealed, setRevealed] = useState<{ apiKey?: string; password?: string; otpAuth?: string } | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isApiKey = entry.type === 'API_KEY';
  const isExpired = entry.expiresAt && new Date(entry.expiresAt) < new Date();
  const isExpiringSoon = entry.expiresAt && !isExpired && new Date(entry.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const handleReveal = async () => {
    if (revealed) { setRevealed(null); return; }
    setIsRevealing(true);
    try {
      const decrypted = await onDecrypt(entry, masterPassword);
      setRevealed({ apiKey: decrypted.apiKey, password: decrypted.password, otpAuth: decrypted.otpAuth });
      onUsed(entry.id);
    } catch {
      toast.error(t('entry.decryptFailed'));
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopySecret = async () => {
    try {
      const decrypted = revealed ?? await onDecrypt(entry, masterPassword);
      const value = isApiKey ? decrypted.apiKey! : decrypted.password!;
      await copy(value, isApiKey ? t('form.apiKey') : t('form.password'));
      onUsed(entry.id);
    } catch {
      toast.error(t('entry.copyFailed'));
    }
  };

  const handleCopyUsername = async () => {
    if (entry.username) await copy(entry.username, t('form.username'));
  };

  const borderClass = isExpired
    ? 'border-error/30'
    : isExpiringSoon
    ? 'border-warning/30'
    : '';

  return (
    <div className={`entry-card ${borderClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Type icon + emoji */}
          <div className="relative flex-shrink-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${
              isApiKey ? 'bg-primary/10' : 'bg-secondary/10'
            }`}>
              {entry.icon ?? (isApiKey ? '🔑' : '👤')}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${
              isApiKey ? 'bg-primary/20' : 'bg-secondary/20'
            }`}>
              {isApiKey
                ? <Key className="w-2 h-2 text-primary" />
                : <User className="w-2 h-2 text-secondary" />
              }
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-text text-sm truncate leading-tight">{entry.name}</h3>
            {entry.service && (
              <p className="text-xs text-text-muted truncate mt-0.5">{entry.service}</p>
            )}
          </div>
        </div>

        {/* Buttons: min 40px tap target */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onToggleFavorite(entry.id, !entry.isFavorite)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
              entry.isFavorite
                ? 'text-warning hover:bg-warning/10'
                : 'text-text-muted hover:text-warning hover:bg-surface'
            }`}
            title={entry.isFavorite ? t('entry.removeFavorite') : t('entry.addFavorite')}
            aria-pressed={entry.isFavorite}
          >
            <Star className="w-3.5 h-3.5" fill={entry.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => onEdit(entry)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text hover:bg-surface transition-all"
            title={t('entry.edit')}
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-error hover:bg-error/10 transition-all"
            title={t('entry.delete')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Secret field */}
      {/* Secret row — buttons 36px minimum */}
      <div className="flex items-center gap-1 bg-surface/60 border border-surface-100/50 rounded-xl px-3 py-2">
        <span className="flex-1 font-mono text-xs truncate min-w-0">
          {revealed
            ? <span className="text-success text-xs">{isApiKey ? revealed.apiKey : revealed.password}</span>
            : <span className="masked-value select-none">••••••••••••</span>
          }
        </span>

        <button
          onClick={handleReveal}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors flex-shrink-0"
          disabled={isRevealing}
          title={revealed ? t('entry.hide') : t('entry.show')}
        >
          {isRevealing ? (
            <span className="w-3.5 h-3.5 border border-text-muted border-t-transparent rounded-full animate-spin block" />
          ) : revealed ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={handleCopySecret}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-primary hover:bg-surface transition-colors flex-shrink-0"
          title={isApiKey ? t('entry.copyApiKey') : t('entry.copyPassword')}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2FA-Code — nur im entsperrten Zustand, da der Schlüssel im Blob liegt */}
      {revealed?.otpAuth && <TotpCode otpAuth={revealed.otpAuth} />}

      {/* Username / URL row */}
      {(entry.username || externalUrl) && (
        <div className="flex items-center gap-2 text-xs">
          {entry.username && (
            <button
              onClick={handleCopyUsername}
              className="flex items-center gap-1.5 text-text-muted hover:text-text transition-colors min-w-0 flex-1 group"
              title={t('entry.copyUsername')}
            >
              <Copy className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="truncate">{entry.username}</span>
            </button>
          )}
          {externalUrl && (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-secondary/70 hover:text-secondary transition-colors ml-auto flex-shrink-0"
              title={t('entry.open')}
            >
              <ExternalLink className="w-3 h-3" />
              <span>{t('entry.open')}</span>
            </a>
          )}
        </div>
      )}

      {/* Footer: categories + expiry */}
      {(entry.categories.length > 0 || entry.expiresAt) && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {entry.categories.map(cat => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
              style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
            >
              <Tag className="w-2 h-2" />
              {cat.name}
            </span>
          ))}

          {entry.expiresAt && (
            <span className={`flex items-center gap-1 text-[10px] ml-auto ${isExpired ? 'text-error' : 'text-warning'}`}>
              <Clock className="w-3 h-3" />
              {isExpired ? t('entry.expiredLabel') : t('entry.expires')} {formatDate(entry.expiresAt)}
            </span>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mt-1 p-3 bg-error/8 border border-error/25 rounded-xl animate-scale-in">
          <p className="text-xs text-text mb-2.5">
            {t('entry.deleteConfirm', { name: entry.name })}
          </p>
          <div className="flex gap-2">
            <button onClick={() => onDelete(entry.id)} className="btn-danger flex-1 py-1.5 text-xs">
              {t('entry.delete')}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 py-1.5 text-xs">
              {t('entry.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
