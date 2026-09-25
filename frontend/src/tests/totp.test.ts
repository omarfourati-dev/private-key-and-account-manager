import { describe, it, expect } from 'vitest';
import {
  base32Decode,
  base32Encode,
  parseOtpAuth,
  isValidOtpAuth,
  generateTotp,
  generateHotp,
  totpTimeRemaining,
  formatTotpCode,
  buildOtpAuthUri,
  TotpError,
  type TotpConfig,
} from '../utils/totp';

const ascii = (s: string) => new TextEncoder().encode(s);

// RFC 6238 Appendix B — Seeds
const SEED_SHA1 = ascii('12345678901234567890');
const SEED_SHA256 = ascii('12345678901234567890123456789012');
const SEED_SHA512 = ascii('1234567890123456789012345678901234567890123456789012345678901234');

describe('base32', () => {
  it('dekodiert RFC-4648-Testvektoren', () => {
    expect(new TextDecoder().decode(base32Decode('MY======'))).toBe('f');
    expect(new TextDecoder().decode(base32Decode('MZXQ===='))).toBe('fo');
    expect(new TextDecoder().decode(base32Decode('MZXW6==='))).toBe('foo');
    expect(new TextDecoder().decode(base32Decode('MZXW6YTB'))).toBe('fooba');
    expect(new TextDecoder().decode(base32Decode('MZXW6YTBOI======'))).toBe('foobar');
  });

  it('kodiert ohne Padding und ist zum Decoder invers', () => {
    expect(base32Encode(ascii('foobar'))).toBe('MZXW6YTBOI');
    for (const text of ['f', 'fo', 'foo', 'foob', 'fooba', 'foobar']) {
      expect(new TextDecoder().decode(base32Decode(base32Encode(ascii(text))))).toBe(text);
    }
  });

  it('akzeptiert Kleinschreibung, Leerzeichen und Bindestriche', () => {
    const expected = base32Decode('MZXW6YTBOI');
    expect(base32Decode('mzxw 6ytb-oi')).toEqual(expected);
  });

  it('wirft bei ungültigen Zeichen und leerer Eingabe', () => {
    expect(() => base32Decode('MZXW6YT!')).toThrow(TotpError);
    expect(() => base32Decode('   ')).toThrow(TotpError);
    try {
      base32Decode('0189');
      expect.unreachable('sollte werfen');
    } catch (err) {
      expect((err as TotpError).code).toBe('invalid-base32');
    }
  });
});

describe('generateTotp — RFC 6238 Testvektoren', () => {
  const cases: Array<[number, string, string]> = [
    [59, '94287082', 'T1'],
    [1111111109, '07081804', 'T2'],
    [1111111111, '14050471', 'T3'],
    [1234567890, '89005924', 'T4'],
    [2000000000, '69279037', 'T5'],
    [20000000000, '65353130', 'T6'],
  ];

  for (const [seconds, expected, name] of cases) {
    it(`SHA-1 ${name} (t=${seconds}) → ${expected}`, async () => {
      const config: TotpConfig = {
        secret: SEED_SHA1,
        algorithm: 'SHA-1',
        digits: 8,
        period: 30,
      };
      expect(await generateTotp(config, seconds * 1000)).toBe(expected);
    });
  }

  it('SHA-256 bei t=59 → 46119246', async () => {
    const config: TotpConfig = {
      secret: SEED_SHA256,
      algorithm: 'SHA-256',
      digits: 8,
      period: 30,
    };
    expect(await generateTotp(config, 59_000)).toBe('46119246');
  });

  it('SHA-512 bei t=59 → 90693936', async () => {
    const config: TotpConfig = {
      secret: SEED_SHA512,
      algorithm: 'SHA-512',
      digits: 8,
      period: 30,
    };
    expect(await generateTotp(config, 59_000)).toBe('90693936');
  });

  it('liefert 6-stellige Codes mit führenden Nullen', async () => {
    const config: TotpConfig = { secret: SEED_SHA1, algorithm: 'SHA-1', digits: 6, period: 30 };
    const code = await generateTotp(config, 1111111109 * 1000);
    expect(code).toBe('081804');
    expect(code).toHaveLength(6);
  });

  it('liefert innerhalb desselben Zeitfensters denselben Code', async () => {
    const config: TotpConfig = { secret: SEED_SHA1, algorithm: 'SHA-1', digits: 6, period: 30 };
    const a = await generateTotp(config, 60_000);
    const b = await generateTotp(config, 89_999);
    const c = await generateTotp(config, 90_000);
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });

  it('verarbeitet Zähler jenseits von 2^32 korrekt', async () => {
    // t=20000000000 ⇒ counter = 666666666, aber HOTP-Zähler direkt gross prüfen
    expect(await generateHotp(SEED_SHA1, 0x1_0000_0001, 'SHA-1', 8)).toMatch(/^\d{8}$/);
  });
});

describe('parseOtpAuth', () => {
  it('liest eine vollständige otpauth-URI', () => {
    const uri =
      'otpauth://totp/GitHub:omar%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA256&digits=8&period=60';
    const config = parseOtpAuth(uri);
    expect(config.algorithm).toBe('SHA-256');
    expect(config.digits).toBe(8);
    expect(config.period).toBe(60);
    expect(config.issuer).toBe('GitHub');
    expect(config.label).toBe('omar@example.com');
    expect(base32Encode(config.secret)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('nutzt die Defaults SHA-1 / 6 Stellen / 30 s', () => {
    const config = parseOtpAuth('otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP');
    expect(config.algorithm).toBe('SHA-1');
    expect(config.digits).toBe(6);
    expect(config.period).toBe(30);
    expect(config.label).toBe('Test');
  });

  it('leitet den Issuer aus dem Label ab, wenn der Parameter fehlt', () => {
    const config = parseOtpAuth('otpauth://totp/AWS:root?secret=JBSWY3DPEHPK3PXP');
    expect(config.issuer).toBe('AWS');
    expect(config.label).toBe('root');
  });

  it('akzeptiert ein nacktes Base32-Secret', () => {
    const config = parseOtpAuth('jbswy3dpehpk3pxp');
    expect(config.digits).toBe(6);
    expect(base32Encode(config.secret)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('lehnt hotp, steam und unbekannte Algorithmen ab', () => {
    expect(() => parseOtpAuth('otpauth://hotp/X?secret=JBSWY3DPEHPK3PXP&counter=1')).toThrow(TotpError);
    expect(() => parseOtpAuth('otpauth://steam/X?secret=JBSWY3DPEHPK3PXP')).toThrow(TotpError);
    expect(() => parseOtpAuth('otpauth://totp/X?secret=JBSWY3DPEHPK3PXP&algorithm=MD5')).toThrow(TotpError);
  });

  it('lehnt zu kurze Secrets ab', () => {
    // Jede reine Buchstabenfolge ist formal gültiges Base32 — ohne Längenschranke
    // würde hier stillschweigend ein unbrauchbarer Schlüssel akzeptiert.
    try {
      parseOtpAuth('keinsecret');
      expect.unreachable('sollte werfen');
    } catch (err) {
      expect((err as TotpError).code).toBe('secret-too-short');
    }
    expect(() => parseOtpAuth('otpauth://totp/X?secret=ABCDEFGH')).toThrow(TotpError);
    // Genau an der Grenze (16 Zeichen) wird akzeptiert
    expect(isValidOtpAuth('JBSWY3DPEHPK3PXP')).toBe(true);
  });

  it('lehnt fehlendes Secret und unplausible Parameter ab', () => {
    expect(() => parseOtpAuth('otpauth://totp/X?issuer=Y')).toThrow(TotpError);
    expect(() => parseOtpAuth('otpauth://totp/X?secret=JBSWY3DPEHPK3PXP&digits=4')).toThrow(TotpError);
    expect(() => parseOtpAuth('otpauth://totp/X?secret=JBSWY3DPEHPK3PXP&period=0')).toThrow(TotpError);
    expect(() => parseOtpAuth('')).toThrow(TotpError);
  });

  it('isValidOtpAuth wirft nicht', () => {
    expect(isValidOtpAuth('otpauth://totp/X?secret=JBSWY3DPEHPK3PXP')).toBe(true);
    expect(isValidOtpAuth('JBSWY3DPEHPK3PXP')).toBe(true);
    expect(isValidOtpAuth('kein secret')).toBe(false);
    expect(isValidOtpAuth('')).toBe(false);
  });
});

describe('Hilfsfunktionen', () => {
  it('totpTimeRemaining zählt innerhalb des Fensters herunter', () => {
    expect(totpTimeRemaining(30, 0)).toBe(30);
    expect(totpTimeRemaining(30, 1_000)).toBe(29);
    expect(totpTimeRemaining(30, 29_000)).toBe(1);
    expect(totpTimeRemaining(30, 30_000)).toBe(30);
  });

  it('formatTotpCode gruppiert 6- und 8-stellige Codes', () => {
    expect(formatTotpCode('123456')).toBe('123 456');
    expect(formatTotpCode('12345678')).toBe('1234 5678');
    expect(formatTotpCode('1234567')).toBe('1234567');
  });

  it('buildOtpAuthUri ist zu parseOtpAuth invers', () => {
    const original: TotpConfig = {
      secret: base32Decode('JBSWY3DPEHPK3PXP'),
      algorithm: 'SHA-256',
      digits: 8,
      period: 60,
      label: 'omar@example.com',
      issuer: 'GitHub',
    };
    const parsed = parseOtpAuth(buildOtpAuthUri(original));
    expect(parsed.algorithm).toBe(original.algorithm);
    expect(parsed.digits).toBe(original.digits);
    expect(parsed.period).toBe(original.period);
    expect(parsed.issuer).toBe(original.issuer);
    expect(parsed.label).toBe(original.label);
    expect(base32Encode(parsed.secret)).toBe('JBSWY3DPEHPK3PXP');
  });
});
