/**
 * Client-side AES-256-GCM encryption utility.
 * The encryption key is derived from the master password using PBKDF2.
 * No plaintext data is ever sent to the server.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a CryptoKey from the master password using PBKDF2.
 */
export async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a JSON-serializable value with AES-256-GCM.
 * Returns a base64-encoded string containing: salt + iv + ciphertext
 */
export async function encryptData(data: unknown, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt.buffer);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // Concatenate: salt (32) + iv (12) + ciphertext
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  return bufferToBase64(combined.buffer);
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 */
export async function decryptData<T = unknown>(encryptedBase64: string, password: string): Promise<T> {
  const combined = new Uint8Array(base64ToBuffer(encryptedBase64));

  const salt = combined.slice(0, SALT_LENGTH).buffer;
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext)) as T;
}

/**
 * Re-encrypts all entries with a new password.
 */
export async function reEncryptData(
  encryptedBase64: string,
  oldPassword: string,
  newPassword: string
): Promise<string> {
  const data = await decryptData(encryptedBase64, oldPassword);
  return encryptData(data, newPassword);
}

// ── Vault Key (symmetric escrow layer) ──────────────────────────────────────

export function generateVaultKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function vaultKeyToString(vaultKey: Uint8Array): string {
  return bufferToBase64(vaultKey.buffer as ArrayBuffer);
}

export function stringToVaultKey(str: string): Uint8Array {
  return new Uint8Array(base64ToBuffer(str));
}

/** Wraps the raw vault key bytes with AES-GCM keyed from PBKDF2(password). */
export async function wrapVaultKey(vaultKey: Uint8Array, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt.buffer as ArrayBuffer);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, vaultKey.buffer as ArrayBuffer);
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);
  return bufferToBase64(combined.buffer as ArrayBuffer);
}

/** Unwraps the vault key bytes using the user's password. */
export async function unwrapVaultKey(wrapped: string, password: string): Promise<Uint8Array> {
  const combined = new Uint8Array(base64ToBuffer(wrapped));
  const salt = combined.slice(0, SALT_LENGTH).buffer as ArrayBuffer;
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);
  const key = await deriveKey(password, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext.buffer as ArrayBuffer);
  return new Uint8Array(plaintext);
}

// ── Admin RSA-OAEP keypair (for admin password reset escrow) ─────────────────

export async function generateAdminKeypair(): Promise<{ publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey }> {
  const keypair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt']
  );
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keypair.publicKey),
    crypto.subtle.exportKey('jwk', keypair.privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

export async function encryptVaultKeyForAdmin(vaultKey: Uint8Array, adminPublicKeyJwk: JsonWebKey): Promise<string> {
  const publicKey = await crypto.subtle.importKey(
    'jwk', adminPublicKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, vaultKey.buffer as ArrayBuffer);
  return bufferToBase64(encrypted);
}

export async function decryptVaultKeyWithAdminKey(encrypted: string, adminPrivateKeyJwk: JsonWebKey): Promise<Uint8Array> {
  const privateKey = await crypto.subtle.importKey(
    'jwk', adminPrivateKeyJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, base64ToBuffer(encrypted));
  return new Uint8Array(plaintext);
}

/** Encrypts the admin RSA private key JWK with AES-GCM using the vault key directly. */
export async function encryptAdminPrivateKey(privateKeyJwk: JsonWebKey, vaultKey: Uint8Array): Promise<string> {
  const aesKey = await crypto.subtle.importKey('raw', vaultKey.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(privateKeyJwk));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext);
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return bufferToBase64(combined.buffer as ArrayBuffer);
}

/** Decrypts the admin RSA private key JWK using the vault key. */
export async function decryptAdminPrivateKey(encrypted: string, vaultKey: Uint8Array): Promise<JsonWebKey> {
  const combined = new Uint8Array(base64ToBuffer(encrypted));
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const aesKey = await crypto.subtle.importKey('raw', vaultKey.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as JsonWebKey;
}
