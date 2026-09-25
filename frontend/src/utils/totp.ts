/**
 * TOTP (RFC 6238) auf Basis von HOTP (RFC 4226).
 *
 * Alle Funktionen sind frei von React- und Netzwerk-Abhängigkeiten und damit direkt
 * unit-testbar. Das Secret verlässt dieses Modul nie — es wird ausschliesslich an
 * `crypto.subtle` übergeben.
 */

export type TotpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface TotpConfig {
  secret: Uint8Array;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  label?: string;
  issuer?: string;
}

export type TotpErrorCode =
  | 'empty'
  | 'invalid-base32'
  | 'missing-secret'
  | 'secret-too-short'
  | 'unsupported-type'
  | 'unsupported-algorithm'
  | 'invalid-digits'
  | 'invalid-period';

export class TotpError extends Error {
  constructor(public readonly code: TotpErrorCode) {
    super(code);
    this.name = 'TotpError';
  }
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Mindestlänge eines Secrets in Base32-Zeichen (16 Zeichen = 80 Bit).
 *
 * Nötig, weil jede reine Buchstabenfolge formal gültiges Base32 ist — ohne diese Schranke
 * würde die Eingabe "kein secret" klaglos als Authenticator-Schlüssel akzeptiert.
 * 16 Zeichen ist die kleinste Länge, die in der Praxis vorkommt (Google, GitHub, AWS).
 */
const MIN_SECRET_CHARS = 16;

/** Dekodiert ein Secret und stellt sicher, dass es plausibel lang ist. */
function decodeSecret(raw: string): Uint8Array {
  const cleaned = raw.replace(/[\s-]/g, '').replace(/=+$/, '');
  if (cleaned.length === 0) throw new TotpError('empty');
  const decoded = base32Decode(cleaned);
  if (cleaned.length < MIN_SECRET_CHARS) throw new TotpError('secret-too-short');
  return decoded;
}

/** Base32-Decode nach RFC 4648. Padding, Leerzeichen und Kleinschreibung sind erlaubt. */
export function base32Decode(input: string): Uint8Array {
  const cleaned = input.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
  if (cleaned.length === 0) throw new TotpError('empty');

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new TotpError('invalid-base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }

  if (out.length === 0) throw new TotpError('invalid-base32');
  return new Uint8Array(out);
}

/** Base32-Encode nach RFC 4648, ohne Padding (wie in otpauth-URIs üblich). */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return out;
}

function normalizeAlgorithm(raw: string | null): TotpAlgorithm {
  if (!raw) return 'SHA-1';
  const normalized = raw.replace(/-/g, '').toUpperCase();
  if (normalized === 'SHA1') return 'SHA-1';
  if (normalized === 'SHA256') return 'SHA-256';
  if (normalized === 'SHA512') return 'SHA-512';
  throw new TotpError('unsupported-algorithm');
}

/**
 * Nimmt eine `otpauth://totp/...`-URI oder ein nacktes Base32-Secret entgegen.
 * `otpauth://hotp/...` und Steam-Guard werden bewusst abgelehnt — für zählerbasierte
 * bzw. proprietäre Verfahren gilt eine andere Logik.
 */
export function parseOtpAuth(input: string): TotpConfig {
  const trimmed = input.trim();
  if (!trimmed) throw new TotpError('empty');

  if (!/^otpauth:\/\//i.test(trimmed)) {
    // Nacktes Base32-Secret
    return {
      secret: decodeSecret(trimmed),
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
    };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new TotpError('unsupported-type');
  }

  const type = url.host.toLowerCase();
  if (type !== 'totp') throw new TotpError('unsupported-type');

  const params = url.searchParams;
  const secretRaw = params.get('secret');
  if (!secretRaw) throw new TotpError('missing-secret');

  const digits = params.get('digits') ? parseInt(params.get('digits')!, 10) : 6;
  if (!Number.isInteger(digits) || digits < 6 || digits > 10) {
    throw new TotpError('invalid-digits');
  }

  const period = params.get('period') ? parseInt(params.get('period')!, 10) : 30;
  if (!Number.isInteger(period) || period < 1 || period > 300) {
    throw new TotpError('invalid-period');
  }

  // Pfad ist "/Issuer:Account" oder "/Account", jeweils URL-kodiert
  const path = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const colonIdx = path.indexOf(':');
  const labelIssuer = colonIdx > -1 ? path.slice(0, colonIdx).trim() : undefined;
  const label = colonIdx > -1 ? path.slice(colonIdx + 1).trim() : path.trim();

  return {
    secret: decodeSecret(secretRaw),
    algorithm: normalizeAlgorithm(params.get('algorithm')),
    digits,
    period,
    label: label || undefined,
    issuer: params.get('issuer') ?? labelIssuer,
  };
}

/** Prüft eine Eingabe, ohne zu werfen — für Live-Validierung im Formular. */
export function isValidOtpAuth(input: string): boolean {
  try {
    parseOtpAuth(input);
    return true;
  } catch {
    return false;
  }
}

function counterToBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8);
  // Zähler kann > 2^32 werden; deshalb als BigInt-freie Zwei-Hälften-Rechnung
  let high = Math.floor(counter / 0x100000000);
  let low = counter >>> 0;
  for (let i = 7; i >= 4; i--) {
    buf[i] = low & 0xff;
    low = low >>> 8;
  }
  for (let i = 3; i >= 0; i--) {
    buf[i] = high & 0xff;
    high = Math.floor(high / 256);
  }
  return buf;
}

/** HOTP nach RFC 4226 mit dynamischer Truncation. */
export async function generateHotp(
  secret: Uint8Array,
  counter: number,
  algorithm: TotpAlgorithm = 'SHA-1',
  digits = 6
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret.buffer.slice(secret.byteOffset, secret.byteOffset + secret.byteLength) as ArrayBuffer,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );

  const counterBytes = counterToBytes(counter);
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, counterBytes.buffer as ArrayBuffer)
  );

  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** TOTP nach RFC 6238 für den angegebenen Zeitpunkt (Default: jetzt). */
export async function generateTotp(config: TotpConfig, atMs: number = Date.now()): Promise<string> {
  const counter = Math.floor(atMs / 1000 / config.period);
  return generateHotp(config.secret, counter, config.algorithm, config.digits);
}

/** Verbleibende Sekunden im aktuellen Zeitfenster (1…period). */
export function totpTimeRemaining(period: number, atMs: number = Date.now()): number {
  const elapsed = Math.floor(atMs / 1000) % period;
  return period - elapsed;
}

/** Formatiert einen Code für die Anzeige: 6 → "123 456", 8 → "1234 5678". */
export function formatTotpCode(code: string): string {
  if (code.length === 6) return `${code.slice(0, 3)} ${code.slice(3)}`;
  if (code.length === 8) return `${code.slice(0, 4)} ${code.slice(4)}`;
  return code;
}

/** Baut eine otpauth-URI, z. B. für QR-Anzeige beim Export. */
export function buildOtpAuthUri(config: TotpConfig): string {
  const label = config.issuer
    ? `${encodeURIComponent(config.issuer)}:${encodeURIComponent(config.label ?? '')}`
    : encodeURIComponent(config.label ?? '');

  const params = new URLSearchParams({ secret: base32Encode(config.secret) });
  if (config.issuer) params.set('issuer', config.issuer);
  if (config.algorithm !== 'SHA-1') params.set('algorithm', config.algorithm.replace('-', ''));
  if (config.digits !== 6) params.set('digits', String(config.digits));
  if (config.period !== 30) params.set('period', String(config.period));

  return `otpauth://totp/${label}?${params.toString()}`;
}
