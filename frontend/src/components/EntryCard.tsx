import React, { useState } from 'react';
import { Eye, EyeOff, Copy, Edit2, Trash2, ExternalLink, Clock, Tag } from 'lucide-react';
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
    if (revealed) {
      setRevealed(null);
      return;
    }

    setIsRevealing(true);
    try {
      const decrypted = await onDecrypt(entry, masterPassword);
      setRevealed({
        apiKey: decrypted.apiKey,
        password: decrypted.password,
      });
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
    if (entry.username) {
      await copy(entry.username, 'Username');
    }
  };

  return (
    <div className={`card flex flex-col gap-3 hover:border-surface-100 transition-colors ${isExpired ? 'border-error/30' : isExpiringSoon ? 'border-warning/30' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{entry.icon}</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-text truncate">{entry.name}</h3>
            {entry.service && (
              <p className="text-xs text-text-muted truncate">{entry.service}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(entry)} className="btn-ghost p-1.5" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-ghost p-1.5 hover:text-error"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Secret field */}
      <div className="flex items-center gap-2 bg-surface rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-sm truncate">
          {revealed
            ? (isApiKey ? revealed.apiKey : revealed.password) ?? '••••••••••'
            : <span className="masked-value">••••••••••••</span>
          }
        </span>

        <button
          onClick={handleReveal}
          className="text-text-muted hover:text-text transition-colors flex-shrink-0"
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
          className="text-text-muted hover:text-text transition-colors flex-shrink-0"
          title={isApiKey ? 'Copy API Key' : 'Copy Password'}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Username / URL row */}
      {(entry.username || entry.url) && (
        <div className="flex items-center gap-2 text-sm">
          {entry.username && (
            <button
              onClick={handleCopyUsername}
              className="flex items-center gap-1 text-text-muted hover:text-text transition-colors min-w-0"
              title="Copy username"
            >
              <Copy className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-32">{entry.username}</span>
            </button>
          )}
          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-secondary hover:text-primary transition-colors ml-auto flex-shrink-0"
              title="Open URL"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline text-xs">Open</span>
            </a>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Categories */}
        {entry.categories.map(cat => (
          <span
            key={cat.id}
            className="badge text-xs"
            style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
          >
            <Tag className="w-2.5 h-2.5 mr-1" />
            {cat.name}
          </span>
        ))}

        {/* Expiry */}
        {entry.expiresAt && (
          <span className={`flex items-center gap-1 text-xs ml-auto ${isExpired ? 'text-error' : 'text-warning'}`}>
            <Clock className="w-3 h-3" />
            {isExpired ? 'Expired' : 'Exp'} {new Date(entry.expiresAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="mt-2 p-3 bg-error/10 border border-error/30 rounded-lg">
          <p className="text-sm text-text mb-3">Delete &quot;{entry.name}&quot;? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={() => onDelete(entry.id)}
              className="btn-danger flex-1 py-1.5 text-sm"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="btn-secondary flex-1 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
