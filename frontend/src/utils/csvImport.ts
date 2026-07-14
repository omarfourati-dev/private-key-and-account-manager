/**
 * CSV import logic for Apple Passwords and Google/Chrome Password Manager exports.
 *
 * Everything in this module is pure and crypto-free so it can be unit-tested.
 * The raw CSV contains plaintext passwords: callers must keep parsed rows out
 * of persistent state and drop references as soon as the import completes.
 */

export type CsvFormat = 'apple' | 'chrome';

export const MAX_CSV_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;

export type CsvImportErrorCode = 'empty-file' | 'json-file' | 'unknown-format' | 'too-many-rows';

export class CsvImportError extends Error {
  constructor(public readonly code: CsvImportErrorCode) {
    super(code);
    this.name = 'CsvImportError';
  }
}

export interface CsvCredential {
  /** Display name (Apple "Title" / Chrome "name"), with host/username fallback */
  name: string;
  /** Raw URL from the CSV; android:// URIs are preserved here but never stored */
  url: string | null;
  username: string | null;
  password: string;
  note: string | null;
  otpAuth: string | null;
  /** Normalized host or android package, used for the service column */
  service: string | null;
  isAndroidApp: boolean;
  /** 1-based row position in the parsed CSV (header = row 1) */
  rowNum: number;
}

export interface ParsedCsv {
  format: CsvFormat;
  rows: CsvCredential[];
  skippedEmptyPassword: number;
  malformedRows: number[];
}

/** An existing vault entry reduced to what the merge planner needs (ACCOUNT only). */
export interface ExistingCredential {
  id: string;
  key: string | null;
  updatedAt: string;
  url: string | null;
  note: string | null;
  service: string | null;
}

export interface DecryptedSecret {
  password?: string;
  otpAuth?: string;
}

export interface PlannedUpdate {
  id: string;
  credential: CsvCredential;
  /** Metadata that is empty in the vault and gets filled from the CSV */
  fillFields: { url?: string; note?: string; service?: string };
}

export interface ImportPlan {
  creates: CsvCredential[];
  updates: PlannedUpdate[];
  unchanged: number;
  /** Row numbers superseded by a later row with the same key in the CSV */
  droppedCsvRows: number[];
  /** Match keys that exist more than once in the vault (only newest is updated) */
  vaultDuplicateKeys: string[];
  /** Colliding entries whose blob could not be decrypted — never overwritten */
  undecryptable: number;
}

/**
 * Minimal RFC 4180 parser: quoted fields, "" escapes, CR/LF inside quotes, BOM strip.
 * Hand-rolled on purpose — plaintext passwords should not flow through a third-party dependency.
 */
export function parseCsv(text: string): string[][] {
  let input = text;
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.length > 1 || r[0].trim() !== '');
}

export function detectFormat(header: string[]): CsvFormat | null {
  const names = header.map(h => h.trim().toLowerCase());
  if (!names.includes('password')) return null;
  if (names.includes('title')) return 'apple';
  if (names.includes('name')) return 'chrome';
  return null;
}

const HEADER_ALIASES: Record<string, keyof Pick<CsvCredential, 'name' | 'url' | 'username' | 'password' | 'note' | 'otpAuth'>> = {
  title: 'name',
  name: 'name',
  url: 'url',
  username: 'username',
  password: 'password',
  notes: 'note',
  note: 'note',
  otpauth: 'otpAuth',
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').trim().normalize('NFC').toLowerCase();
}

const ANDROID_URI_PREFIX = 'android://';
const PACKAGE_NAME_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;

function androidPackageFromUri(uri: string): string | null {
  const withoutPrefix = uri.slice(ANDROID_URI_PREFIX.length);
  const atIndex = withoutPrefix.lastIndexOf('@');
  const pkg = withoutPrefix.slice(atIndex + 1).replace(/\/.*$/, '').trim();
  return pkg !== '' ? pkg.toLowerCase() : null;
}

function hostFromUrl(rawUrl: string): string | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  try {
    let host = new URL(withScheme).hostname.toLowerCase();
    host = host.replace(/^www\./, '').replace(/\.$/, '');
    return host !== '' ? host : null;
  } catch {
    return null;
  }
}

/**
 * Builds the identity key used to match a credential across imports.
 * Namespaces: app|<package>|<user>, web|<host>|<user>, name|<name>|<user>.
 * Exact equality only — no fuzzy matching, subdomains stay distinct.
 */
export function buildMatchKey(
  url: string | null,
  username: string | null,
  name: string,
  service?: string | null
): string | null {
  const user = normalizeText(username);
  const trimmedUrl = (url ?? '').trim();

  if (trimmedUrl.toLowerCase().startsWith(ANDROID_URI_PREFIX)) {
    const pkg = androidPackageFromUri(trimmedUrl);
    if (pkg) return `app|${pkg}|${user}`;
    // degenerate android:// URI without a package: fall through to the
    // name-based key so the row still matches the entry it once created
  } else if (trimmedUrl !== '') {
    const host = hostFromUrl(trimmedUrl);
    if (host) return `web|${host}|${user}`;
  }

  const trimmedService = (service ?? '').trim();
  if (trimmedUrl === '' && PACKAGE_NAME_PATTERN.test(trimmedService)) {
    return `app|${trimmedService.toLowerCase()}|${user}`;
  }

  const normalizedName = normalizeText(name);
  return normalizedName === '' ? null : `name|${normalizedName}|${user}`;
}

function buildCredential(values: Partial<Record<'name' | 'url' | 'username' | 'password' | 'note' | 'otpAuth', string>>, rowNum: number): CsvCredential {
  const url = values.url?.trim() || null;
  const isAndroidApp = (url ?? '').toLowerCase().startsWith(ANDROID_URI_PREFIX);
  const service = isAndroidApp ? androidPackageFromUri(url!) : url ? hostFromUrl(url) : null;
  // name/username are truncated here (not just at payload time) so the match
  // key computed from the CSV row equals the one from the stored entry
  const name = (values.name?.trim() || service || values.username?.trim() || 'Imported entry').slice(0, 255);

  return {
    name,
    url,
    username: values.username?.trim().slice(0, 255) || null,
    password: values.password ?? '',
    note: values.note?.trim() || null,
    otpAuth: values.otpAuth?.trim() || null,
    service,
    isAndroidApp,
    rowNum,
  };
}

export function parsePasswordCsv(text: string): ParsedCsv {
  const firstChar = text.trimStart()[0];
  if (firstChar === '{' || firstChar === '[') throw new CsvImportError('json-file');

  const rows = parseCsv(text);
  if (rows.length === 0) throw new CsvImportError('empty-file');
  if (rows.length - 1 > MAX_CSV_ROWS) throw new CsvImportError('too-many-rows');

  const format = detectFormat(rows[0]);
  if (!format) throw new CsvImportError('unknown-format');

  type CsvField = 'name' | 'url' | 'username' | 'password' | 'note' | 'otpAuth';
  const columns = new Map<CsvField, number>();
  rows[0].forEach((headerName, index) => {
    const field = HEADER_ALIASES[headerName.trim().toLowerCase()];
    if (field && !columns.has(field)) columns.set(field, index);
  });
  const passwordIndex = columns.get('password')!;

  const credentials: CsvCredential[] = [];
  let skippedEmptyPassword = 0;
  const malformedRows: number[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
    if (row.length <= passwordIndex) {
      malformedRows.push(rowNum);
      continue;
    }
    const values: Partial<Record<'name' | 'url' | 'username' | 'password' | 'note' | 'otpAuth', string>> = {};
    for (const [field, index] of columns) {
      values[field as keyof typeof values] = row[index] ?? '';
    }
    if (!values.password || values.password === '') {
      skippedEmptyPassword++;
      continue;
    }
    credentials.push(buildCredential(values, rowNum));
  }

  return { format, rows: credentials, skippedEmptyPassword, malformedRows };
}

interface LogicalRow {
  credential: CsvCredential;
  key: string | null;
}

function secretIdentity(password: string, otpAuth: string | null | undefined): string {
  return `${password}\u0000${otpAuth ?? ''}`;
}

/** Collapses same-key CSV rows: identical secrets merge, otherwise the last row wins. */
function dedupeCsvRows(credentials: CsvCredential[]): { logical: LogicalRow[]; droppedCsvRows: number[] } {
  const byKey = new Map<string, CsvCredential[]>();
  const logical: LogicalRow[] = [];

  for (const credential of credentials) {
    const key = buildMatchKey(credential.url, credential.username, credential.name, credential.service);
    if (key === null) {
      logical.push({ credential, key: null });
      continue;
    }
    const group = byKey.get(key);
    if (group) {
      group.push(credential);
    } else {
      const newGroup = [credential];
      byKey.set(key, newGroup);
      logical.push({ credential, key });
    }
  }

  const droppedCsvRows: number[] = [];
  for (const entry of logical) {
    if (entry.key === null) continue;
    const group = byKey.get(entry.key)!;
    if (group.length === 1) continue;
    const winner = group[group.length - 1];
    const identities = new Set(group.map(c => secretIdentity(c.password, c.otpAuth)));
    if (identities.size > 1) {
      droppedCsvRows.push(...group.slice(0, -1).map(c => c.rowNum));
    }
    entry.credential = winner;
  }

  return { logical, droppedCsvRows };
}

function newestPerKey(existing: ExistingCredential[]): { targets: Map<string, ExistingCredential>; duplicateKeys: Set<string> } {
  const targets = new Map<string, ExistingCredential>();
  const duplicateKeys = new Set<string>();

  for (const entry of existing) {
    if (entry.key === null) continue;
    const current = targets.get(entry.key);
    if (!current) {
      targets.set(entry.key, entry);
    } else {
      duplicateKeys.add(entry.key);
      if (entry.updatedAt > current.updatedAt) targets.set(entry.key, entry);
    }
  }

  return { targets, duplicateKeys };
}

/** Entry ids whose blobs must be decrypted before planning (key collisions only). */
export function getDecryptionTargets(candidates: CsvCredential[], existing: ExistingCredential[]): string[] {
  const { logical } = dedupeCsvRows(candidates);
  const { targets } = newestPerKey(existing);
  const ids = new Set<string>();
  for (const row of logical) {
    if (row.key === null) continue;
    const target = targets.get(row.key);
    if (target) ids.add(target.id);
  }
  return [...ids];
}

function fillFieldsFor(target: ExistingCredential, credential: CsvCredential): PlannedUpdate['fillFields'] {
  const fillFields: PlannedUpdate['fillFields'] = {};
  const importUrl = credential.isAndroidApp ? null : credential.url;
  if (!target.url && importUrl) fillFields.url = importUrl.slice(0, 2048);
  if (!target.note && credential.note) fillFields.note = credential.note.slice(0, 2000);
  if (!target.service && credential.service) fillFields.service = credential.service.slice(0, 255);
  return fillFields;
}

/**
 * Plans the merge: CSV owns the secret, the user owns the metadata.
 * Identical secret -> unchanged (never rewritten); different -> update newest match; no match -> create.
 */
export function buildImportPlan(
  candidates: CsvCredential[],
  existing: ExistingCredential[],
  decryptedByEntryId: Map<string, DecryptedSecret | null>
): ImportPlan {
  const { logical, droppedCsvRows } = dedupeCsvRows(candidates);
  const { targets, duplicateKeys } = newestPerKey(existing);

  const plan: ImportPlan = {
    creates: [],
    updates: [],
    unchanged: 0,
    droppedCsvRows,
    vaultDuplicateKeys: [],
    undecryptable: 0,
  };
  const collidedDuplicateKeys = new Set<string>();

  for (const row of logical) {
    const target = row.key !== null ? targets.get(row.key) : undefined;
    if (!target) {
      plan.creates.push(row.credential);
      continue;
    }
    if (duplicateKeys.has(row.key!)) collidedDuplicateKeys.add(row.key!);

    const secret = decryptedByEntryId.get(target.id);
    if (secret === null || secret === undefined) {
      plan.undecryptable++;
      continue;
    }
    // A CSV without an otp value makes no claim about the TOTP secret
    // (Chrome exports have no OTPAuth column) — only compare when present,
    // otherwise re-imports would rewrite otp-carrying entries forever.
    const same = secret.password === row.credential.password
      && (row.credential.otpAuth === null || (secret.otpAuth ?? '') === row.credential.otpAuth);
    if (same) {
      plan.unchanged++;
    } else {
      plan.updates.push({
        id: target.id,
        credential: row.credential,
        fillFields: fillFieldsFor(target, row.credential),
      });
    }
  }

  plan.vaultDuplicateKeys = [...collidedDuplicateKeys];
  return plan;
}

/** Plaintext entry fields for a create payload (encryptedData is added by the caller). */
export function toCreateFields(credential: CsvCredential): {
  type: 'ACCOUNT';
  name: string;
  icon: string;
  service: string | null;
  username: string | null;
  url: string | null;
  note: string | null;
} {
  return {
    type: 'ACCOUNT',
    name: credential.name.slice(0, 255),
    icon: '🌐',
    service: credential.service?.slice(0, 255) ?? null,
    username: credential.username?.slice(0, 255) ?? null,
    url: credential.isAndroidApp ? null : credential.url?.slice(0, 2048) ?? null,
    note: credential.note?.slice(0, 2000) ?? null,
  };
}
