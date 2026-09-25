import type { EntryFormData, EntryType } from '../types';

/** Felder, die im verschlüsselten Blob landen — nie im Klartext an das Backend. */
export const SENSITIVE_FIELDS = ['apiKey', 'password', 'otpAuth'] as const;

export type SensitiveData = Record<string, unknown>;

/** Das Geheimnis, das ein Eintragstyp hauptsächlich trägt. */
function primarySecretOf(type: EntryType): 'apiKey' | 'password' {
  return type === 'API_KEY' ? 'apiKey' : 'password';
}

/** Blob für einen neuen Eintrag. Ein 2FA-Schlüssel wird nur bei Konten gespeichert. */
export function buildSensitiveData(formData: EntryFormData): SensitiveData {
  const data: SensitiveData = formData.type === 'API_KEY'
    ? { apiKey: formData.apiKey }
    : { password: formData.password };

  if (formData.type === 'ACCOUNT' && formData.otpAuth) data['otpAuth'] = formData.otpAuth;
  return data;
}

/** Muss der Blob bei diesem Update neu verschlüsselt werden? */
export function needsReEncryption(changes: Partial<EntryFormData>, previousType: EntryType): boolean {
  if (SENSITIVE_FIELDS.some(field => changes[field] !== undefined)) return true;
  // Typwechsel Konto → API-Key: der 2FA-Schlüssel muss aus dem Blob verschwinden
  return changes.type !== undefined && changes.type !== previousType;
}

/**
 * Führt die Änderungen in den bestehenden, entschlüsselten Blob zusammen.
 *
 * - Nicht übergebene Felder bleiben erhalten (Merge statt Ersetzen) — wer nur den
 *   2FA-Schlüssel ändert, verliert dadurch nicht das Passwort.
 * - Das Hauptgeheimnis des Zieltyps wird übernommen, auch wenn es leer ist.
 *   Ein leeres Nebengeheimnis (z. B. `password: ''` bei einem API-Key aus dem Formular)
 *   gilt als "nicht angefasst".
 * - `otpAuth: ''` entfernt den 2FA-Schlüssel bewusst.
 * - Ist der Zieltyp API_KEY, wird ein 2FA-Schlüssel immer entfernt: TOTP gibt es nur
 *   für Konten, und ein unsichtbar mitgeschlepptes Secret soll nicht im Blob bleiben.
 */
export function mergeSensitiveData(
  existing: SensitiveData,
  changes: Partial<EntryFormData>,
  previousType: EntryType
): SensitiveData {
  const targetType = changes.type ?? previousType;
  const primary = primarySecretOf(targetType);
  const merged: SensitiveData = { ...existing };

  for (const field of ['apiKey', 'password'] as const) {
    const value = changes[field];
    if (value === undefined) continue;
    if (field !== primary && value === '') continue;
    merged[field] = value;
  }

  if (targetType === 'API_KEY') {
    delete merged['otpAuth'];
  } else if (changes.otpAuth !== undefined) {
    if (changes.otpAuth) merged['otpAuth'] = changes.otpAuth;
    else delete merged['otpAuth'];
  }

  return merged;
}
