import { useCallback, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { encryptData, decryptData } from '../utils/crypto';
import { useAuth } from './useAuth';
import {
  parsePasswordCsv,
  buildMatchKey,
  getDecryptionTargets,
  buildImportPlan,
  toCreateFields,
  type CsvFormat,
  type ImportPlan,
  type ExistingCredential,
  type DecryptedSecret,
} from '../utils/csvImport';
import type { Entry } from '../types';

const DECRYPT_CONCURRENCY = 8;
const UPLOAD_CHUNK_SIZE = 500;

export class ImportAbortedError extends Error {
  constructor(public readonly reason: 'vault-locked' | 'cancelled') {
    super(reason);
    this.name = 'ImportAbortedError';
  }
}

/** Upload failed; `created`/`updated` report what earlier chunks already committed. */
export class ImportUploadError extends Error {
  constructor(public readonly created: number, public readonly updated: number) {
    super('upload-failed');
    this.name = 'ImportUploadError';
  }
  get partial(): boolean {
    return this.created + this.updated > 0;
  }
}

export interface ImportProgress {
  phase: 'comparing' | 'encrypting' | 'uploading';
  done: number;
  total: number;
}

export interface PreviewItem {
  name: string;
  username: string | null;
  service: string | null;
  action: 'create' | 'update';
  hasOtp: boolean;
}

/** Plaintext-free summary of an analyzed CSV — safe to keep in React state. */
export interface AnalyzeSummary {
  format: CsvFormat;
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  skippedEmptyPassword: number;
  malformedRows: number[];
  droppedCsvRows: number[];
  vaultDuplicates: number;
  undecryptable: number;
  otpCount: number;
  previewItems: PreviewItem[];
}

export interface ImportResult {
  created: number;
  updated: number;
  unchanged: number;
}

interface UseCsvImportReturn {
  analyze: (csvText: string, onProgress?: (p: ImportProgress) => void) => Promise<AnalyzeSummary>;
  execute: (options: { assignCategory: boolean }, onProgress?: (p: ImportProgress) => void) => Promise<ImportResult>;
  reset: () => void;
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const CATEGORY_BY_FORMAT: Record<CsvFormat, string> = {
  apple: 'Apple Import',
  chrome: 'Google Import',
};

/**
 * Orchestrates the CSV smart-merge import. The parsed plan holds plaintext
 * passwords, so it lives only in refs (never React state) and is dropped on
 * completion, abort, or vault lock.
 */
export function useCsvImport(): UseCsvImportReturn {
  const { masterPassword, isLocked } = useAuth();

  const vaultKeyRef = useRef(masterPassword);
  vaultKeyRef.current = masterPassword;
  const lockedRef = useRef(isLocked);
  lockedRef.current = isLocked;

  const planRef = useRef<ImportPlan | null>(null);
  const formatRef = useRef<CsvFormat | null>(null);
  const secretsRef = useRef<Map<string, DecryptedSecret | null>>(new Map());
  const cancelledRef = useRef(false);

  // Auto-lock swaps the app to the lock screen and unmounts the wizard, so
  // render-phase ref syncing stops — these effects still abort the in-flight
  // import at its next chunk boundary.
  useEffect(() => {
    lockedRef.current = isLocked;
    if (isLocked) cancelledRef.current = true;
  }, [isLocked]);
  useEffect(() => () => {
    cancelledRef.current = true;
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = true;
    planRef.current = null;
    formatRef.current = null;
    secretsRef.current = new Map();
  }, []);

  const assertActive = useCallback(() => {
    if (cancelledRef.current) throw new ImportAbortedError('cancelled');
    if (lockedRef.current || vaultKeyRef.current === null) {
      reset();
      throw new ImportAbortedError('vault-locked');
    }
  }, [reset]);

  const analyze = useCallback(async (
    csvText: string,
    onProgress?: (p: ImportProgress) => void
  ): Promise<AnalyzeSummary> => {
    cancelledRef.current = false;
    assertActive();
    const vaultKey = vaultKeyRef.current!;

    const parsed = parsePasswordCsv(csvText);

    const { data } = await api.get<{ entries: Entry[] }>('/entries');
    const accountEntries = data.entries.filter(e => e.type === 'ACCOUNT');
    const existing: ExistingCredential[] = accountEntries.map(e => ({
      id: e.id,
      key: buildMatchKey(e.url ?? null, e.username ?? null, e.name, e.service ?? null),
      updatedAt: e.updatedAt,
      url: e.url ?? null,
      note: e.note ?? null,
      service: e.service ?? null,
    }));
    const blobById = new Map(accountEntries.map(e => [e.id, e.encryptedData]));

    const targetIds = getDecryptionTargets(parsed.rows, existing);
    const secrets = new Map<string, DecryptedSecret | null>();
    let compared = 0;
    for (const chunk of chunked(targetIds, DECRYPT_CONCURRENCY)) {
      assertActive();
      await Promise.all(chunk.map(async (id) => {
        const secret = await decryptData<DecryptedSecret>(blobById.get(id)!, vaultKey)
          .catch(() => null);
        secrets.set(id, secret);
      }));
      compared += chunk.length;
      onProgress?.({ phase: 'comparing', done: compared, total: targetIds.length });
    }

    const plan = buildImportPlan(parsed.rows, existing, secrets);
    planRef.current = plan;
    formatRef.current = parsed.format;
    secretsRef.current = secrets;

    return {
      format: parsed.format,
      newCount: plan.creates.length,
      updateCount: plan.updates.length,
      unchangedCount: plan.unchanged,
      skippedEmptyPassword: parsed.skippedEmptyPassword,
      malformedRows: parsed.malformedRows,
      droppedCsvRows: plan.droppedCsvRows,
      vaultDuplicates: plan.vaultDuplicateKeys.length,
      undecryptable: plan.undecryptable,
      otpCount: plan.creates.filter(c => c.otpAuth).length
        + plan.updates.filter(u => u.credential.otpAuth).length,
      previewItems: [
        ...plan.creates.map((c): PreviewItem => ({
          name: c.name, username: c.username, service: c.service,
          action: 'create', hasOtp: !!c.otpAuth,
        })),
        ...plan.updates.map((u): PreviewItem => ({
          name: u.credential.name, username: u.credential.username, service: u.credential.service,
          action: 'update', hasOtp: !!u.credential.otpAuth,
        })),
      ],
    };
  }, [assertActive]);

  const execute = useCallback(async (
    options: { assignCategory: boolean },
    onProgress?: (p: ImportProgress) => void
  ): Promise<ImportResult> => {
    const plan = planRef.current;
    const format = formatRef.current;
    if (!plan || !format) throw new Error('No import plan — run analyze first');
    assertActive();
    const vaultKey = vaultKeyRef.current!;

    const totalToEncrypt = plan.creates.length + plan.updates.length;
    let encrypted = 0;
    const reportEncrypted = (count: number) => {
      encrypted += count;
      onProgress?.({ phase: 'encrypting', done: encrypted, total: totalToEncrypt });
    };

    const createPayloads: Array<ReturnType<typeof toCreateFields> & { encryptedData: string }> = [];
    for (const chunk of chunked(plan.creates, DECRYPT_CONCURRENCY)) {
      assertActive();
      const payloads = await Promise.all(chunk.map(async (credential) => ({
        ...toCreateFields(credential),
        encryptedData: await encryptData(
          { password: credential.password, ...(credential.otpAuth ? { otpAuth: credential.otpAuth } : {}) },
          vaultKey
        ),
      })));
      createPayloads.push(...payloads);
      reportEncrypted(chunk.length);
    }

    const updatePayloads: Array<{ id: string; encryptedData: string } & ImportPlan['updates'][number]['fillFields']> = [];
    for (const chunk of chunked(plan.updates, DECRYPT_CONCURRENCY)) {
      assertActive();
      const payloads = await Promise.all(chunk.map(async (update) => {
        const existingSecret = secretsRef.current.get(update.id) ?? {};
        const merged: DecryptedSecret = {
          ...existingSecret,
          password: update.credential.password,
          ...(update.credential.otpAuth ? { otpAuth: update.credential.otpAuth } : {}),
        };
        return {
          id: update.id,
          encryptedData: await encryptData(merged, vaultKey),
          ...update.fillFields,
        };
      }));
      updatePayloads.push(...payloads);
      reportEncrypted(chunk.length);
    }

    const createChunks = chunked(createPayloads, UPLOAD_CHUNK_SIZE);
    const updateChunks = chunked(updatePayloads, UPLOAD_CHUNK_SIZE);
    const requestCount = Math.max(createChunks.length, updateChunks.length);
    let created = 0;
    let updated = 0;

    try {
      for (let i = 0; i < requestCount; i++) {
        assertActive();
        const creates = createChunks[i] ?? [];
        const updates = updateChunks[i] ?? [];
        const { data } = await api.post<{ created: number; updated: number }>('/import/bulk', {
          source: format,
          ...(options.assignCategory && creates.length > 0
            ? { categoryName: CATEGORY_BY_FORMAT[format] }
            : {}),
          creates,
          updates,
        });
        created += data.created;
        updated += data.updated;
        onProgress?.({ phase: 'uploading', done: i + 1, total: requestCount });
      }
    } catch (err) {
      // The plan is stale once any chunk committed — drop it so a retry is
      // forced through a fresh analyze (idempotent merge skips what landed).
      planRef.current = null;
      formatRef.current = null;
      secretsRef.current = new Map();
      if (err instanceof ImportAbortedError) throw err;
      throw new ImportUploadError(created, updated);
    }

    const unchanged = plan.unchanged;
    planRef.current = null;
    formatRef.current = null;
    secretsRef.current = new Map();

    return { created, updated, unchanged };
  }, [assertActive]);

  return { analyze, execute, reset };
}
