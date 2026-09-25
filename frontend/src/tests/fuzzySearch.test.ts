import { describe, it, expect } from 'vitest';
import { normalize, scoreMatch, searchEntries, type SearchableEntry } from '../utils/fuzzySearch';

describe('normalize', () => {
  it('senkt Grossschreibung und entfernt Diakritika', () => {
    expect(normalize('Müller')).toBe('muller');
    expect(normalize('Café')).toBe('cafe');
    expect(normalize('STRASSE')).toBe('strasse');
  });
});

describe('scoreMatch — Rangfolge', () => {
  it('bewertet exakte Treffer am höchsten', () => {
    expect(scoreMatch('github', 'GitHub')).toBe(100);
  });

  it('ordnet die Trefferarten in der erwarteten Reihenfolge', () => {
    const exact = scoreMatch('aws', 'AWS');
    const prefix = scoreMatch('aws', 'AWS Root Account');
    const wordStart = scoreMatch('root', 'AWS Root Account');
    const substring = scoreMatch('oot', 'AWS Root Account');
    const scattered = scoreMatch('asa', 'AWS Root Account');

    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(wordStart);
    expect(wordStart).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(scattered);
    expect(scattered).toBeGreaterThan(0);
  });

  it('bevorzugt bei gleicher Trefferart den kürzeren Eintrag', () => {
    expect(scoreMatch('aws', 'AWS Prod')).toBeGreaterThan(scoreMatch('aws', 'AWS Production Root Account'));
  });

  it('findet verstreute Zeichen in der richtigen Reihenfolge', () => {
    expect(scoreMatch('gthb', 'GitHub')).toBeGreaterThan(0);
    expect(scoreMatch('bhtg', 'GitHub')).toBe(0);
  });

  it('gibt 0 für leere Eingaben und Nichttreffer zurück', () => {
    expect(scoreMatch('', 'GitHub')).toBe(0);
    expect(scoreMatch('gitlab', 'GitHub')).toBe(0);
    expect(scoreMatch('x', '')).toBe(0);
  });

  it('behandelt Regex-Sonderzeichen als Text', () => {
    expect(() => scoreMatch('a.b(c', 'irgendwas')).not.toThrow();
    expect(scoreMatch('c++', 'C++ Lizenz')).toBeGreaterThan(0);
  });
});

describe('searchEntries', () => {
  const entries: SearchableEntry[] = [
    { id: '1', name: 'GitHub', service: 'github.com', username: 'omar' },
    { id: '2', name: 'AWS Root Account', service: 'aws.amazon.com', username: 'root@example.com' },
    { id: '3', name: 'OpenAI Production', service: 'OpenAI', categories: [{ name: 'AI' }] },
    { id: '4', name: 'Stripe Live Key', service: 'Stripe', url: 'https://dashboard.stripe.com' },
  ];

  it('gibt ohne Suchbegriff die Eingangsreihenfolge zurück', () => {
    const results = searchEntries('', entries);
    expect(results.map(r => r.item.id)).toEqual(['1', '2', '3', '4']);
  });

  it('findet über den Namen', () => {
    const results = searchEntries('github', entries);
    expect(results[0].item.id).toBe('1');
    expect(results[0].matchedField).toBe('name');
  });

  it('findet über den Dienst, wenn der Name nicht passt', () => {
    const results = searchEntries('amazon', entries);
    expect(results[0].item.id).toBe('2');
    expect(results[0].matchedField).toBe('service');
  });

  it('findet über die Kategorie', () => {
    const results = searchEntries('AI', entries);
    expect(results.some(r => r.item.id === '3')).toBe(true);
  });

  it('gewichtet Namenstreffer höher als URL-Treffer', () => {
    const withUrlOnly: SearchableEntry[] = [
      { id: 'a', name: 'Irgendwas', url: 'https://stripe.com' },
      { id: 'b', name: 'Stripe' },
    ];
    expect(searchEntries('stripe', withUrlOnly)[0].item.id).toBe('b');
  });

  it('liefert keine Treffer ohne Übereinstimmung', () => {
    expect(searchEntries('zzzznichts', entries)).toHaveLength(0);
  });

  it('begrenzt die Ergebnismenge', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: `Eintrag ${i}` }));
    expect(searchEntries('eintrag', many, 50)).toHaveLength(50);
  });

  it('ist gegenüber Umlauten und Grossschreibung tolerant', () => {
    const umlaut: SearchableEntry[] = [{ id: 'u', name: 'Müller Bank' }];
    expect(searchEntries('muller', umlaut)).toHaveLength(1);
    expect(searchEntries('MÜLLER', umlaut)).toHaveLength(1);
  });
});
