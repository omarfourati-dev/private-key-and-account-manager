import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Edit2, Trash2, ExternalLink, Clock, Tag, Key, User } from 'lucide-react';
import { useClipboard } from '../hooks/useClipboard';
import type { Entry, DecryptedEntry } from '../types';
import toast from 'react-hot-toast';

interface EntryCardProps {
  entry: Entry;
  masterPassword: string;
  onEdit: (entry: Entry) => void;
  onDelete: (id: string) => void;
  onDecrypt: (entry: Entry, password: string) => Promise<DecryptedEntry>;
}

export default function EntryCard({ entry, masterPassword, onEdit, onDelete, onDecrypt }: EntryCardProps): React.ReactElement {
  const { copy } = useClipboard();
  const [revealed, setRevealed] = useState<{ apiKey?: string; password?: string } | null>(null);
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
      setRevealed({ apiKey: decrypted.apiKey, password: decrypted.password });
    } catch {
      toast.error('Failed to decrypt. Check your master password.');
    } finally {
      setIsRevealing(false);
    }
  };

  const handleCopySecret = async () => {
    try {
      const decrypted = revealed ?? await onDecrypt(entry, masterPassword);
      const value = isApiKey ? decrypted.apiKey! : decrypted.password!;
      await copy(value, isApiKey ? 'API Key' : 'Password');
    } catch {
      toast.error('Failed to copy. Decryption error.');
    }
  };

  const handleCopyUsername = async () => {
    if (entry.username) await copy(entry.username, 'Username');
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

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => onEdit(entry)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-all"
            title="Edit"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-all"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Secret field */}
      <div className="flex items-center gap-2 bg-surface/60 border border-surface-100/50 rounded-xl px-3 py-2">
        <span className="flex-1 font-mono text-xs truncate min-w-0">
          {revealed
            ? <span className="text-success">{isApiKey ? revealed.apiKey : revealed.password}</span>
            : <span className="masked-value select-none">••••••••••••</span>
          }
        </span>

        <button
          onClick={handleReveal}
          className="text-text-muted hover:text-text transition-colors flex-shrink-0 p-0.5"
          disabled={isRevealing}
          title={revealed ? 'Hide' : 'Show'}
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
          className="text-text-muted hover:text-primary transition-colors flex-shrink-0 p-0.5"
          title={isApiKey ? 'Copy API Key' : 'Copy Password'}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Username / URL row */}
      {(entry.username || entry.url) && (
        <div className="flex items-center gap-2 text-xs">
          {entry.username && (
            <button
              onClick={handleCopyUsername}
              className="flex items-center gap-1.5 text-text-muted hover:text-text transition-colors min-w-0 flex-1 group"
              title="Copy username"
            >
              <Copy className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="truncate">{entry.username}</span>
            </button>
          )}
          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-secondary/70 hover:text-secondary transition-colors ml-auto flex-shrink-0"
              title="Open URL"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open</span>
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
              {isExpired ? 'Expired' : 'Exp.'} {new Date(entry.expiresAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mt-1 p-3 bg-error/8 border border-error/25 rounded-xl animate-scale-in">
          <p className="text-xs text-text mb-2.5">
            Delete <strong className="text-error">"{entry.name}"</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={() => onDelete(entry.id)} className="btn-danger flex-1 py-1.5 text-xs">
              Delete
            </button>
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 py-1.5 text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
