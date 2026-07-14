import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  detectFormat,
  parsePasswordCsv,
  buildMatchKey,
  getDecryptionTargets,
  buildImportPlan,
  toCreateFields,
  CsvImportError,
  type CsvCredential,
  type ExistingCredential,
  type DecryptedSecret,
} from '../utils/csvImport';

const APPLE_HEADER = 'Title,URL,Username,Password,Notes,OTPAuth';
const CHROME_HEADER = 'name,url,username,password,note';

function credential(overrides: Partial<CsvCredential>): CsvCredential {
  return {
    name: 'GitHub',
    url: 'https://github.com',
    username: 'omar',
    password: 'secret1',
    note: null,
    otpAuth: null,
    service: 'github.com',
    isAndroidApp: false,
    rowNum: 2,
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingCredential>): ExistingCredential {
  return {
    id: 'entry-1',
    key: buildMatchKey('https://github.com', 'omar', 'GitHub'),
    updatedAt: '2026-01-01T00:00:00.000Z',
    url: 'https://github.com',
    note: null,
    service: 'github.com',
    ...overrides,
  };
}

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('handles quoted fields with commas', () => {
    expect(parseCsv('"a,b",c')).toEqual([['a,b', 'c']]);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(parseCsv('"say ""hi""",x')).toEqual([['say "hi"', 'x']]);
  });

  it('handles newlines inside quoted fields', () => {
    expect(parseCsv('"line1\nline2",x')).toEqual([['line1\nline2', 'x']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d\r\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('strips a UTF-8 BOM', () => {
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']]);
  });

  it('keeps umlauts and other UTF-8 intact', () => {
    expect(parseCsv('Bücher,Straße')).toEqual([['Bücher', 'Straße']]);
  });

  it('drops fully empty lines', () => {
    expect(parseCsv('a,b\n\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('preserves empty fields', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });
});

describe('detectFormat', () => {
  it('detects the Apple header', () => {
    expect(detectFormat(APPLE_HEADER.split(','))).toBe('apple');
  });

  it('detects the Chrome header with and without note', () => {
    expect(detectFormat(CHROME_HEADER.split(','))).toBe('chrome');
    expect(detectFormat(['name', 'url', 'username', 'password'])).toBe('chrome');
  });

  it('is case-insensitive', () => {
    expect(detectFormat(['TITLE', 'Url', 'USERNAME', 'Password', 'NOTES'])).toBe('apple');
  });

  it('returns null for unknown headers', () => {
    expect(detectFormat(['foo', 'bar'])).toBeNull();
    expect(detectFormat(['name', 'url'])).toBeNull();
  });
});

describe('parsePasswordCsv', () => {
  it('rejects JSON exports', () => {
    expect(() => parsePasswordCsv('  {"version":"1.0.0"}')).toThrowError(CsvImportError);
    expect(() => parsePasswordCsv('[]')).toThrow('json-file');
  });

  it('rejects empty files', () => {
    expect(() => parsePasswordCsv('')).toThrow('empty-file');
  });

  it('rejects unknown formats', () => {
    expect(() => parsePasswordCsv('foo,bar\n1,2')).toThrow('unknown-format');
  });

  it('parses an Apple CSV with quoted commas, umlauts and OTPAuth', () => {
    const csv = [
      APPLE_HEADER,
      '"Mein Konto, privat",https://beispiel.de/login,omar,"pa,ss""wort",Notiz mit Ümlaut,otpauth://totp/x?secret=ABC',
    ].join('\n');

    const parsed = parsePasswordCsv(csv);
    expect(parsed.format).toBe('apple');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      name: 'Mein Konto, privat',
      url: 'https://beispiel.de/login',
      username: 'omar',
      password: 'pa,ss"wort',
      note: 'Notiz mit Ümlaut',
      otpAuth: 'otpauth://totp/x?secret=ABC',
      service: 'beispiel.de',
    });
  });

  it('parses a Chrome CSV with an android app credential', () => {
    const csv = [
      CHROME_HEADER,
      'Spotify,android://Kx2fZ8basehash=@com.spotify.music/,omar@web.de,pw123,',
    ].join('\n');

    const parsed = parsePasswordCsv(csv);
    expect(parsed.format).toBe('chrome');
    expect(parsed.rows[0]).toMatchObject({
      name: 'Spotify',
      isAndroidApp: true,
      service: 'com.spotify.music',
      password: 'pw123',
    });
  });

  it('skips rows with empty passwords (passkey-only rows) and counts them', () => {
    const csv = [APPLE_HEADER, 'Passkey Site,https://pk.example,omar,,,', 'Real,https://r.example,omar,pw,,'].join('\n');
    const parsed = parsePasswordCsv(csv);
    expect(parsed.skippedEmptyPassword).toBe(1);
    expect(parsed.rows).toHaveLength(1);
  });

  it('reports malformed rows that are too short', () => {
    const csv = [CHROME_HEADER, 'onlyname', 'ok,https://x.example,u,pw,'].join('\n');
    const parsed = parsePasswordCsv(csv);
    expect(parsed.malformedRows).toEqual([2]);
    expect(parsed.rows).toHaveLength(1);
  });

  it('does not trim passwords', () => {
    const csv = [CHROME_HEADER, 'x,https://x.example,u," pw with spaces ",'].join('\n');
    expect(parsePasswordCsv(csv).rows[0].password).toBe(' pw with spaces ');
  });

  it('falls back to host, then username, for missing names', () => {
    const csv = [CHROME_HEADER, ',https://fallback.example,u,pw,', ',,justuser,pw,'].join('\n');
    const parsed = parsePasswordCsv(csv);
    expect(parsed.rows[0].name).toBe('fallback.example');
    expect(parsed.rows[1].name).toBe('justuser');
  });
});

describe('buildMatchKey', () => {
  it('normalizes web URLs to host + lowercase username', () => {
    expect(buildMatchKey('https://www.github.com/login?next=x', 'Omar', 'GitHub'))
      .toBe('web|github.com|omar');
  });

  it('adds a scheme when missing', () => {
    expect(buildMatchKey('github.com', 'omar', 'GitHub')).toBe('web|github.com|omar');
  });

  it('keeps subdomains distinct', () => {
    expect(buildMatchKey('https://app.example.com', 'u', 'X'))
      .not.toBe(buildMatchKey('https://example.com', 'u', 'X'));
  });

  it('extracts the package from android URIs and drops the cert hash', () => {
    expect(buildMatchKey('android://someHash=@com.spotify.music/', 'omar', 'Spotify'))
      .toBe('app|com.spotify.music|omar');
  });

  it('uses the service column as package for stored android entries (url null)', () => {
    expect(buildMatchKey(null, 'omar', 'Spotify', 'com.spotify.music'))
      .toBe('app|com.spotify.music|omar');
  });

  it('falls back to the name namespace without url', () => {
    expect(buildMatchKey(null, 'omar', 'My Router')).toBe('name|my router|omar');
  });

  it('returns null when neither url nor name identify the row', () => {
    expect(buildMatchKey(null, 'omar', '  ')).toBeNull();
  });

  it('falls back to the name key for degenerate android URIs without a package', () => {
    // the CSV row and the entry it creates (url=null, service=null) must agree
    expect(buildMatchKey('android://hash@/', 'omar', 'My App'))
      .toBe(buildMatchKey(null, 'omar', 'My App', null));
  });

  it('keeps the key stable when names longer than 255 chars are truncated on create', () => {
    const longName = 'x'.repeat(300);
    const csv = ['name,url,username,password,note', `${longName},,omar,pw,`].join('\n');
    const parsed = parsePasswordCsv(csv);
    const storedName = parsed.rows[0].name;
    expect(storedName).toHaveLength(255);
    expect(buildMatchKey(null, 'omar', storedName))
      .toBe(buildMatchKey(parsed.rows[0].url, parsed.rows[0].username, parsed.rows[0].name, parsed.rows[0].service));
  });

  it('treats empty username as a distinct legal key part', () => {
    expect(buildMatchKey('https://x.example', null, 'X')).toBe('web|x.example|');
    expect(buildMatchKey('https://x.example', 'u', 'X')).toBe('web|x.example|u');
  });
});

describe('getDecryptionTargets', () => {
  it('returns only colliding entry ids, newest per key', () => {
    const older = existing({ id: 'old', updatedAt: '2025-01-01T00:00:00.000Z' });
    const newer = existing({ id: 'new', updatedAt: '2026-01-01T00:00:00.000Z' });
    const unrelated = existing({ id: 'other', key: 'web|other.example|u' });

    const targets = getDecryptionTargets([credential({})], [older, newer, unrelated]);
    expect(targets).toEqual(['new']);
  });
});

describe('buildImportPlan', () => {
  it('creates entries with no vault match', () => {
    const plan = buildImportPlan([credential({})], [], new Map());
    expect(plan.creates).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
  });

  it('marks identical secrets as unchanged and never rewrites them', () => {
    const target = existing({});
    const decrypted = new Map<string, DecryptedSecret | null>([['entry-1', { password: 'secret1' }]]);
    const plan = buildImportPlan([credential({})], [target], decrypted);
    expect(plan.unchanged).toBe(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toHaveLength(0);
  });

  it('updates when the password changed', () => {
    const target = existing({});
    const decrypted = new Map<string, DecryptedSecret | null>([['entry-1', { password: 'oldpw' }]]);
    const plan = buildImportPlan([credential({})], [target], decrypted);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe('entry-1');
  });

  it('updates when only the otp secret changed', () => {
    const target = existing({});
    const decrypted = new Map<string, DecryptedSecret | null>([['entry-1', { password: 'secret1' }]]);
    const plan = buildImportPlan([credential({ otpAuth: 'otpauth://totp/x?secret=NEW' })], [target], decrypted);
    expect(plan.updates).toHaveLength(1);
  });

  it('stays idempotent when the vault has an otp secret but the CSV makes no otp claim', () => {
    // Chrome CSVs have no OTPAuth column; that must not count as "otp removed"
    const target = existing({});
    const decrypted = new Map<string, DecryptedSecret | null>([
      ['entry-1', { password: 'secret1', otpAuth: 'otpauth://totp/x?secret=OLD' }],
    ]);
    const plan = buildImportPlan([credential({ otpAuth: null })], [target], decrypted);
    expect(plan.unchanged).toBe(1);
    expect(plan.updates).toHaveLength(0);
  });

  it('fills empty metadata but never overwrites user values', () => {
    const bare = existing({ url: null, note: null, service: null });
    const annotated = existing({ id: 'entry-2', note: 'my own note' });
    const decrypted = new Map<string, DecryptedSecret | null>([
      ['entry-1', { password: 'oldpw' }],
      ['entry-2', { password: 'oldpw' }],
    ]);

    const filled = buildImportPlan([credential({ note: 'csv note' })], [bare], decrypted);
    expect(filled.updates[0].fillFields).toEqual({
      url: 'https://github.com',
      note: 'csv note',
      service: 'github.com',
    });

    const kept = buildImportPlan([credential({ note: 'csv note' })], [annotated], decrypted);
    expect(kept.updates[0].fillFields.note).toBeUndefined();
  });

  it('lets the last CSV row win for same-key rows with different passwords', () => {
    const first = credential({ password: 'old', rowNum: 2 });
    const second = credential({ password: 'newer', rowNum: 5 });
    const plan = buildImportPlan([first, second], [], new Map());
    expect(plan.creates).toHaveLength(1);
    expect(plan.creates[0].password).toBe('newer');
    expect(plan.droppedCsvRows).toEqual([2]);
  });

  it('collapses identical same-key rows without reporting drops', () => {
    const plan = buildImportPlan([credential({ rowNum: 2 }), credential({ rowNum: 3 })], [], new Map());
    expect(plan.creates).toHaveLength(1);
    expect(plan.droppedCsvRows).toEqual([]);
  });

  it('updates only the newest vault duplicate and reports the key', () => {
    const older = existing({ id: 'old', updatedAt: '2025-01-01T00:00:00.000Z' });
    const newer = existing({ id: 'new', updatedAt: '2026-01-01T00:00:00.000Z' });
    const decrypted = new Map<string, DecryptedSecret | null>([['new', { password: 'oldpw' }]]);

    const plan = buildImportPlan([credential({})], [older, newer], decrypted);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].id).toBe('new');
    expect(plan.vaultDuplicateKeys).toEqual([existing({}).key]);
  });

  it('never touches entries whose blob could not be decrypted', () => {
    const target = existing({});
    const decrypted = new Map<string, DecryptedSecret | null>([['entry-1', null]]);
    const plan = buildImportPlan([credential({})], [target], decrypted);
    expect(plan.undecryptable).toBe(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.creates).toHaveLength(0);
  });
});

describe('toCreateFields', () => {
  it('builds account fields for web credentials', () => {
    expect(toCreateFields(credential({}))).toEqual({
      type: 'ACCOUNT',
      name: 'GitHub',
      icon: '🌐',
      service: 'github.com',
      username: 'omar',
      url: 'https://github.com',
      note: null,
    });
  });

  it('stores android credentials without the raw android URI', () => {
    const androidCredential = credential({
      url: 'android://hash=@com.spotify.music/',
      isAndroidApp: true,
      service: 'com.spotify.music',
      name: 'com.spotify.music',
    });
    const fields = toCreateFields(androidCredential);
    expect(fields.url).toBeNull();
    expect(fields.service).toBe('com.spotify.music');
  });

  it('truncates oversized values to the server limits', () => {
    const fields = toCreateFields(credential({ name: 'x'.repeat(300) }));
    expect(fields.name).toHaveLength(255);
  });
});
