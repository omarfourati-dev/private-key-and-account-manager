/**
 * Fuzzy-Matching für die Command Palette.
 *
 * Bewusst klein gehalten und ohne Fremdbibliothek: Die Suche läuft über die bereits
 * geladenen Einträge im Speicher, es geht nur um eine sinnvolle Rangfolge.
 * Reine Funktionen, damit das Ranking ohne React unit-testbar bleibt.
 */

export const enum MatchScore {
  None = 0,
  Scattered = 10,
  Substring = 40,
  WordStart = 70,
  Prefix = 90,
  Exact = 100,
}

/** Normalisiert für den Vergleich: Kleinschreibung, Diakritika entfernt. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Bewertet, wie gut `query` auf `target` passt (0 = kein Treffer).
 *
 * Rangfolge: exakte Übereinstimmung > Präfix > Wortanfang > Substring > verstreute Zeichen.
 * Innerhalb einer Stufe gewinnt der kürzere Treffer, damit "AWS" vor "AWS Backup Admin" steht.
 */
export function scoreMatch(query: string, target: string): number {
  if (!query) return MatchScore.None;

  const q = normalize(query);
  const t = normalize(target);
  if (!t) return MatchScore.None;

  // Kürzere Treffer bevorzugen — max. 9 Bonuspunkte, damit keine Stufe übersprungen wird
  const brevityBonus = Math.round(9 * (q.length / Math.max(t.length, q.length)));

  if (t === q) return MatchScore.Exact;
  if (t.startsWith(q)) return MatchScore.Prefix + brevityBonus;

  const wordStart = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  if (wordStart.test(t)) return MatchScore.WordStart + brevityBonus;

  if (t.includes(q)) return MatchScore.Substring + brevityBonus;

  // Verstreute Zeichen in der richtigen Reihenfolge ("gthb" → "GitHub")
  let ti = 0;
  for (const char of q) {
    const found = t.indexOf(char, ti);
    if (found === -1) return MatchScore.None;
    ti = found + 1;
  }
  return MatchScore.Scattered + brevityBonus;
}

export interface SearchableEntry {
  id: string;
  name: string;
  service?: string | null;
  username?: string | null;
  url?: string | null;
  categories?: { name: string }[];
}

export interface ScoredResult<T> {
  item: T;
  score: number;
  /** Feld, über das der beste Treffer zustande kam — für die Trefferanzeige */
  matchedField: 'name' | 'service' | 'username' | 'url' | 'category';
}

/** Gewichtung der Felder: Der Name wiegt am schwersten, die URL am wenigsten. */
const FIELD_WEIGHTS = {
  name: 1,
  service: 0.85,
  username: 0.7,
  category: 0.6,
  url: 0.5,
} as const;

/**
 * Sortiert Einträge nach Relevanz. Ohne Suchbegriff wird die Eingangsreihenfolge
 * beibehalten, damit die Palette auch leer eine sinnvolle Liste zeigt.
 */
export function searchEntries<T extends SearchableEntry>(
  query: string,
  entries: T[],
  limit = 50
): ScoredResult<T>[] {
  if (!query.trim()) {
    return entries.slice(0, limit).map(item => ({ item, score: 0, matchedField: 'name' as const }));
  }

  const results: ScoredResult<T>[] = [];

  for (const item of entries) {
    const candidates: Array<[ScoredResult<T>['matchedField'], string | null | undefined]> = [
      ['name', item.name],
      ['service', item.service],
      ['username', item.username],
      ['url', item.url],
      ...(item.categories ?? []).map(
        c => ['category', c.name] as [ScoredResult<T>['matchedField'], string]
      ),
    ];

    let best = 0;
    let bestField: ScoredResult<T>['matchedField'] = 'name';

    for (const [field, value] of candidates) {
      if (!value) continue;
      const weighted = scoreMatch(query, value) * FIELD_WEIGHTS[field];
      if (weighted > best) {
        best = weighted;
        bestField = field;
      }
    }

    if (best > 0) results.push({ item, score: best, matchedField: bestField });
  }

  results.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
  return results.slice(0, limit);
}
