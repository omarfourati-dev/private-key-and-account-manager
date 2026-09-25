import { describe, it, expect } from 'vitest';
import { buildSensitiveData, mergeSensitiveData, needsReEncryption } from '../utils/entryPayload';

const OTP = 'otpauth://totp/Example:me?secret=JBSWY3DPEHPK3PXPJBSWY3DP';

describe('buildSensitiveData', () => {
  it('speichert den 2FA-Schlüssel bei Konten', () => {
    expect(buildSensitiveData({ type: 'ACCOUNT', name: 'x', icon: '🔑', password: 'pw', otpAuth: OTP })).toEqual({
      password: 'pw',
      otpAuth: OTP,
    });
  });

  it('verwirft einen 2FA-Schlüssel bei API-Keys', () => {
    expect(buildSensitiveData({ type: 'API_KEY', name: 'x', icon: '🔑', apiKey: 'sk', otpAuth: OTP })).toEqual({ apiKey: 'sk' });
  });
});

describe('mergeSensitiveData', () => {
  it('behält das Passwort, wenn nur der 2FA-Schlüssel geändert wird', () => {
    const merged = mergeSensitiveData({ password: 'geheim' }, { otpAuth: OTP }, 'ACCOUNT');
    expect(merged).toEqual({ password: 'geheim', otpAuth: OTP });
  });

  it('behält den API-Key, wenn der Typ im Update fehlt', () => {
    const merged = mergeSensitiveData({ apiKey: 'sk-alt' }, { name: 'Umbenannt' } as never, 'API_KEY');
    expect(merged).toEqual({ apiKey: 'sk-alt' });
  });

  it('übernimmt ein geändertes Hauptgeheimnis', () => {
    expect(mergeSensitiveData({ password: 'alt', otpAuth: OTP }, { type: 'ACCOUNT', password: 'neu' }, 'ACCOUNT'))
      .toEqual({ password: 'neu', otpAuth: OTP });
  });

  it('ignoriert ein leeres Nebengeheimnis aus dem Formular', () => {
    expect(mergeSensitiveData({ apiKey: 'sk' }, { type: 'API_KEY', apiKey: 'sk', password: '' }, 'API_KEY'))
      .toEqual({ apiKey: 'sk' });
  });

  it('entfernt den 2FA-Schlüssel bei leerem otpAuth', () => {
    expect(mergeSensitiveData({ password: 'pw', otpAuth: OTP }, { otpAuth: '' }, 'ACCOUNT')).toEqual({ password: 'pw' });
  });

  it('entfernt den 2FA-Schlüssel beim Wechsel Konto → API-Key', () => {
    const merged = mergeSensitiveData(
      { password: 'pw', otpAuth: OTP },
      { type: 'API_KEY', apiKey: 'sk-neu', otpAuth: OTP },
      'ACCOUNT'
    );
    expect(merged).not.toHaveProperty('otpAuth');
    expect(merged['apiKey']).toBe('sk-neu');
  });

  it('verändert den übergebenen Blob nicht', () => {
    const existing = { password: 'pw', otpAuth: OTP };
    mergeSensitiveData(existing, { type: 'API_KEY', apiKey: 'sk' }, 'ACCOUNT');
    expect(existing).toEqual({ password: 'pw', otpAuth: OTP });
  });
});

describe('needsReEncryption', () => {
  it('ist false bei reinen Metadaten-Änderungen', () => {
    expect(needsReEncryption({ name: 'x', url: 'https://a.b' } as never, 'ACCOUNT')).toBe(false);
  });

  it('ist true, sobald ein Geheimnis übergeben wird', () => {
    expect(needsReEncryption({ otpAuth: '' }, 'ACCOUNT')).toBe(true);
  });

  it('ist true beim Typwechsel, damit der 2FA-Schlüssel entfernt wird', () => {
    expect(needsReEncryption({ type: 'API_KEY' }, 'ACCOUNT')).toBe(true);
    expect(needsReEncryption({ type: 'ACCOUNT' }, 'ACCOUNT')).toBe(false);
  });
});
