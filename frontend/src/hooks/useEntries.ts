import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { encryptData, decryptData, reEncryptData } from '../utils/crypto';
import { buildSensitiveData, mergeSensitiveData, needsReEncryption } from '../utils/entryPayload';
import { useT } from '../i18n';
import type { Entry, EntryFormData, DecryptedEntry, FilterState } from '../types';

interface UseEntriesReturn {
  entries: Entry[];
  isLoading: boolean;
  fetchEntries: (filter?: Partial<FilterState>) => Promise<void>;
  createEntry: (formData: EntryFormData, masterPassword: string) => Promise<void>;
  updateEntry: (id: string, formData: Partial<EntryFormData>, masterPassword: string) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  toggleFavorite: (id: string, isFavorite: boolean) => Promise<void>;
  markUsed: (id: string) => void;
  decryptEntry: (entry: Entry, masterPassword: string) => Promise<DecryptedEntry>;
  reEncryptAllEntries: (entries: Entry[], oldPassword: string, newPassword: string) => Promise<{ id: string; encryptedData: string }[]>;
}

export function useEntries(): UseEntriesReturn {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const entriesRef = useRef<Entry[]>(entries);
  const { t } = useT();

  const fetchEntries = useCallback(async (filter?: Partial<FilterState>) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter?.search) params['search'] = filter.search;
      if (filter?.type && filter.type !== 'ALL') params['type'] = filter.type;
      if (filter?.categoryId) params['categoryId'] = filter.categoryId;
      if (filter?.sortBy) params['sortBy'] = filter.sortBy;
      if (filter?.sortOrder) params['sortOrder'] = filter.sortOrder;

      const { data } = await api.get<{ entries: Entry[] }>('/entries', { params });
      entriesRef.current = data.entries;
      setEntries(data.entries);
    } catch {
      toast.error('Failed to load entries');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createEntry = useCallback(async (formData: EntryFormData, masterPassword: string) => {
    const sensitiveData = buildSensitiveData(formData);

    const encryptedData = await encryptData(sensitiveData, masterPassword);

    const { data } = await api.post<{ entry: Entry }>('/entries', {
      type: formData.type,
      name: formData.name,
      icon: formData.icon,
      encryptedData,
      service: formData.service || undefined,
      username: formData.username || undefined,
      url: formData.url || undefined,
      note: formData.note || undefined,
      expiresAt: formData.expiresAt || null,
      categoryIds: formData.categoryIds,
    });

    const updated = [data.entry, ...entriesRef.current];
    entriesRef.current = updated;
    setEntries(updated);
    toast.success('Entry created successfully');
  }, []);

  const updateEntry = useCallback(async (id: string, formData: Partial<EntryFormData>, masterPassword: string) => {
    const updateData: Record<string, unknown> = { ...formData };

    // Use in-state entry to avoid redundant API call
    const existingEntry = entriesRef.current.find(e => e.id === id);
    if (!existingEntry) throw new Error('Entry not found');

    if (needsReEncryption(formData, existingEntry.type)) {
      const existingDecrypted = await decryptData<Record<string, unknown>>(existingEntry.encryptedData, masterPassword);
      const sensitiveData = mergeSensitiveData(existingDecrypted, formData, existingEntry.type);
      updateData['encryptedData'] = await encryptData(sensitiveData, masterPassword);
    }

    delete updateData['apiKey'];
    delete updateData['password'];
    delete updateData['otpAuth'];
    if (updateData['url'] === '') updateData['url'] = null;

    const { data } = await api.put<{ entry: Entry }>(`/entries/${id}`, updateData);
    const updated = entriesRef.current.map(e => e.id === id ? data.entry : e);
    entriesRef.current = updated;
    setEntries(updated);
    toast.success('Entry updated successfully');
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await api.delete(`/entries/${id}`);
    const updated = entriesRef.current.filter(e => e.id !== id);
    entriesRef.current = updated;
    setEntries(updated);
    toast.success('Entry deleted successfully');
  }, []);

  const toggleFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    // Optimistisch umschalten, damit der Stern ohne Verzoegerung reagiert
    const rollback = entriesRef.current;
    const updated = entriesRef.current.map(e => e.id === id ? { ...e, isFavorite } : e);
    entriesRef.current = updated;
    setEntries(updated);

    try {
      await api.patch(`/entries/${id}/favorite`, { isFavorite });
    } catch {
      entriesRef.current = rollback;
      setEntries(rollback);
      toast.error(t('entry.favoriteFailed'));
    }
  }, [t]);

  /**
   * Meldet die Nutzung eines Eintrags (Kopieren/Anzeigen).
   *
   * Bewusst ohne await und ohne Fehlerbehandlung nach aussen: Das Kopieren eines
   * Passworts darf nie an einem fehlgeschlagenen Statistik-Request haengen.
   */
  const markUsed = useCallback((id: string) => {
    const now = new Date().toISOString();
    const updated = entriesRef.current.map(e => e.id === id ? { ...e, lastUsedAt: now } : e);
    entriesRef.current = updated;
    setEntries(updated);
    void api.post(`/entries/${id}/used`).catch(() => {});
  }, []);

  const decryptEntry = useCallback(async (entry: Entry, masterPassword: string): Promise<DecryptedEntry> => {
    const sensitiveData = await decryptData<{ apiKey?: string; password?: string; otpAuth?: string }>(
      entry.encryptedData,
      masterPassword
    );
    const { encryptedData: _, ...rest } = entry;
    void _;
    return { ...rest, ...sensitiveData };
  }, []);

  const reEncryptAllEntries = useCallback(async (
    entries: Entry[],
    oldPassword: string,
    newPassword: string
  ): Promise<{ id: string; encryptedData: string }[]> => {
    return Promise.all(
      entries.map(async (entry) => ({
        id: entry.id,
        encryptedData: await reEncryptData(entry.encryptedData, oldPassword, newPassword),
      }))
    );
  }, []);

  return {
    entries,
    isLoading,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    toggleFavorite,
    markUsed,
    decryptEntry,
    reEncryptAllEntries,
  };
}
