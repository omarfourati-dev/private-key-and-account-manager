import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Key, User, CornerDownLeft, Plus, Lock, Settings as SettingsIcon, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { searchEntries } from '../utils/fuzzySearch';
import { safeExternalUrl } from '../utils/safeUrl';
import { useClipboard } from '../hooks/useClipboard';
import { useT } from '../i18n';
import type { Entry, DecryptedEntry } from '../types';

interface CommandPaletteProps {
  entries: Entry[];
  masterPassword: string | null;
  onDecrypt: (entry: Entry, password: string) => Promise<DecryptedEntry>;
  onUsed: (id: string) => void;
  onEdit: (entry: Entry) => void;
  onCreate: () => void;
  onLock: () => void;
}

interface GlobalCommand {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

const MAX_RESULTS = 50;

/**
 * Tastaturgetriebene Schnellsuche (Cmd/Ctrl+K).
 *
 * Sucht ausschliesslich über die bereits geladenen Einträge im Speicher — kein
 * Netzwerk-Roundtrip pro Tastendruck.
 */
export default function CommandPalette({
  entries,
  masterPassword,
  onDecrypt,
  onUsed,
  onEdit,
  onCreate,
  onLock,
}: CommandPaletteProps): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { copy } = useClipboard();
  const { t } = useT();
  const navigate = useNavigate();

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const globalCommands = useMemo<GlobalCommand[]>(() => [
    { id: 'cmd-new', label: t('palette.newEntry'), icon: Plus, run: () => { close(); onCreate(); } },
    { id: 'cmd-settings', label: t('palette.openSettings'), icon: SettingsIcon, run: () => { close(); navigate('/settings'); } },
    { id: 'cmd-lock', label: t('palette.lockVault'), icon: Lock, run: () => { close(); onLock(); } },
  ], [close, navigate, onCreate, onLock, t]);

  const results = useMemo(() => searchEntries(query, entries, MAX_RESULTS), [query, entries]);

  const matchingCommands = useMemo(() => {
    if (!query.trim()) return globalCommands;
    const q = query.toLowerCase();
    return globalCommands.filter(c => c.label.toLowerCase().includes(q));
  }, [query, globalCommands]);

  const totalItems = results.length + matchingCommands.length;

  // Globale Tastenkombination
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(open => !open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Aktiven Eintrag in den sichtbaren Bereich scrollen
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const withSecret = useCallback(
    async (entry: Entry, pick: (d: DecryptedEntry) => string | undefined, label: string) => {
      if (!masterPassword) return;
      setIsBusy(true);
      try {
        const decrypted = await onDecrypt(entry, masterPassword);
        const value = pick(decrypted);
        if (!value) {
          toast.error(t('palette.notStored', { label }));
          return;
        }
        await copy(value, label);
        onUsed(entry.id);
        close();
      } catch {
        toast.error(t('palette.decryptFailed'));
      } finally {
        setIsBusy(false);
      }
    },
    [masterPassword, onDecrypt, copy, onUsed, close, t]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (totalItems === 0 ? 0 : (i + 1) % totalItems));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (totalItems === 0 ? 0 : (i - 1 + totalItems) % totalItems));
      return;
    }
    if (e.key === 'ArrowRight') {
      const entry = results[activeIndex]?.item;
      if (entry) {
        e.preventDefault();
        close();
        onEdit(entry);
      }
      return;
    }
    if (e.key !== 'Enter') return;

    e.preventDefault();
    if (activeIndex >= results.length) {
      matchingCommands[activeIndex - results.length]?.run();
      return;
    }

    const entry = results[activeIndex]?.item;
    if (!entry) return;

    if (e.shiftKey) {
      if (entry.username) {
        void copy(entry.username, t('form.username')).then(close);
      } else {
        toast.error(t('palette.noUsername'));
      }
      return;
    }
    if (e.metaKey || e.ctrlKey) {
      const externalUrl = safeExternalUrl(entry.url);
      if (externalUrl) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        close();
      } else {
        toast.error(t('palette.noUrl'));
      }
      return;
    }

    void withSecret(
      entry,
      d => (entry.type === 'API_KEY' ? d.apiKey : d.password),
      entry.type === 'API_KEY' ? t('form.apiKey') : t('form.password')
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay items-start pt-[10vh]"
      onClick={e => e.target === e.currentTarget && close()}
    >
      <div
        className="modal-content max-w-xl w-full overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={t('palette.placeholder')}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface">
          <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-text placeholder:text-text-dim text-sm"
            placeholder={t('palette.placeholder')}
            aria-activedescendant={`cmd-item-${activeIndex}`}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          {isBusy && (
            <span className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
          )}
          <kbd className="text-[10px] text-text-dim border border-surface-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1" role="listbox">
          {totalItems === 0 && (
            <p className="text-sm text-text-muted text-center py-8">{t('palette.noResults')}</p>
          )}

          {results.map((result, index) => {
            const entry = result.item;
            const TypeIcon = entry.type === 'API_KEY' ? Key : User;
            return (
              <div
                key={entry.id}
                id={`cmd-item-${index}`}
                data-index={index}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() =>
                  void withSecret(
                    entry,
                    d => (entry.type === 'API_KEY' ? d.apiKey : d.password),
                    entry.type === 'API_KEY' ? t('form.apiKey') : t('form.password')
                  )
                }
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                  index === activeIndex ? 'bg-primary/10' : ''
                }`}
              >
                <span className="text-base flex-shrink-0">{entry.icon ?? '🔑'}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text truncate flex items-center gap-1.5">
                    {entry.name}
                    {entry.isFavorite && <Star className="w-3 h-3 text-warning flex-shrink-0" fill="currentColor" />}
                  </p>
                  {(entry.service || entry.username) && (
                    <p className="text-xs text-text-muted truncate">
                      {[entry.service, entry.username].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <TypeIcon
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    entry.type === 'API_KEY' ? 'text-primary' : 'text-secondary'
                  }`}
                />
                {index === activeIndex && (
                  <CornerDownLeft className="w-3.5 h-3.5 text-text-dim flex-shrink-0" />
                )}
              </div>
            );
          })}

          {matchingCommands.length > 0 && (
            <>
              {results.length > 0 && (
                <p className="section-label px-4 pt-3 pb-1">{t('palette.commands')}</p>
              )}
              {matchingCommands.map((command, i) => {
                const index = results.length + i;
                const Icon = command.icon;
                return (
                  <div
                    key={command.id}
                    id={`cmd-item-${index}`}
                    data-index={index}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={command.run}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer ${
                      index === activeIndex ? 'bg-primary/10' : ''
                    }`}
                  >
                    <Icon className="w-4 h-4 text-text-muted flex-shrink-0" />
                    <span className="text-sm text-text flex-1">{command.label}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-surface text-[10px] text-text-dim flex-wrap">
          <span><kbd className="border border-surface-200 rounded px-1 py-0.5">↵</kbd> {t('palette.hintCopy')}</span>
          <span><kbd className="border border-surface-200 rounded px-1 py-0.5">⇧↵</kbd> {t('palette.hintUsername')}</span>
          <span><kbd className="border border-surface-200 rounded px-1 py-0.5">⌘↵</kbd> {t('palette.hintUrl')}</span>
          <span><kbd className="border border-surface-200 rounded px-1 py-0.5">→</kbd> {t('palette.hintEdit')}</span>
          <span className="ml-auto"><kbd className="border border-surface-200 rounded px-1 py-0.5">↑↓</kbd> {t('palette.hintNavigate')}</span>
        </div>
      </div>
    </div>
  );
}
