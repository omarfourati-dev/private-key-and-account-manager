import { describe, it, expect } from 'vitest';
import { translate, detectLocale, SUPPORTED_LOCALES } from '../i18n';
import { en } from '../i18n/en';
import { de } from '../i18n/de';

describe('Übersetzungskataloge', () => {
  it('deckt in jeder Sprache dieselben Schlüssel ab', () => {
    const enKeys = Object.keys(en).sort();
    const deKeys = Object.keys(de).sort();
    expect(deKeys).toEqual(enKeys);
  });

  it('enthält keine leeren Übersetzungen', () => {
    for (const [key, value] of Object.entries(de)) {
      expect(value.trim(), `leerer Wert für ${key}`).not.toBe('');
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `leerer Wert für ${key}`).not.toBe('');
    }
  });

  it('verwendet in beiden Sprachen dieselben Platzhalter', () => {
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(placeholders(de[key]), `Platzhalter weichen ab bei ${key}`).toEqual(
        placeholders(en[key])
      );
    }
  });
});

describe('translate', () => {
  it('übersetzt in die gewählte Sprache', () => {
    expect(translate('de', 'nav.vault')).toBe('Tresor');
    expect(translate('en', 'nav.vault')).toBe('Vault');
  });

  it('ersetzt Platzhalter', () => {
    expect(translate('de', 'entry.deleteConfirm', { name: 'AWS Root' })).toContain('AWS Root');
    expect(translate('en', 'clipboard.copiedWithClear', { label: 'Password', seconds: 30 }))
      .toBe('Password copied · clears in 30s');
  });

  it('lässt unbekannte Platzhalter stehen, statt sie zu leeren', () => {
    expect(translate('de', 'entry.deleteConfirm', { falsch: 'x' })).toContain('{name}');
  });

  it('gibt den Schlüssel zurück, wenn keine Übersetzung existiert', () => {
    expect(translate('de', 'gibt.es.nicht')).toBe('gibt.es.nicht');
  });

  it('fällt bei unbekannter Sprache auf Deutsch zurück', () => {
    expect(translate('xx' as never, 'nav.vault')).toBe('Tresor');
  });

  it('wählt bei count die passende Pluralform', () => {
    // Ohne definierte Pluralschlüssel bleibt der Basisschlüssel wirksam
    expect(translate('de', 'dashboard.favorites', { count: 1 })).toBe('Favoriten');
    expect(translate('de', 'dashboard.favorites', { count: 5 })).toBe('Favoriten');
  });
});

describe('detectLocale', () => {
  it('liefert eine unterstützte Sprache', () => {
    expect(SUPPORTED_LOCALES).toContain(detectLocale());
  });
});
