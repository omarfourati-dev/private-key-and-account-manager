import type { PrismaClient } from '@prisma/client';

/**
 * Schreibzugriffe auf reine Nutzungs-Markierungen eines Eintrags (Favorit, zuletzt verwendet).
 *
 * Bewusst Raw-SQL statt `prisma.entry.update`: Prisma setzt bei jedem Update `updatedAt`
 * neu, ein Stern oder ein Kopiervorgang ist aber keine inhaltliche Änderung und darf die
 * Sortierung nach "zuletzt bearbeitet" nicht verschieben.
 *
 * Eigentümerprüfung und Schreiben passieren in einer einzigen Anweisung (`userId` im WHERE),
 * damit es kein Zeitfenster zwischen Prüfen und Schreiben gibt. `id` ist eine TEXT-Spalte —
 * kein `::uuid`-Cast, sonst schlägt der Vergleich in Postgres fehl.
 *
 * Rückgabe: `true`, wenn genau der eigene Eintrag getroffen wurde, sonst `false` (→ 404).
 */
type RawExecutor = Pick<PrismaClient, '$executeRaw'>;

export async function setEntryFavorite(
  db: RawExecutor,
  id: string,
  userId: string,
  isFavorite: boolean
): Promise<boolean> {
  const affected = await db.$executeRaw`UPDATE "entries" SET "isFavorite" = ${isFavorite} WHERE "id" = ${id} AND "userId" = ${userId}`;
  return affected > 0;
}

export async function markEntryUsed(
  db: RawExecutor,
  id: string,
  userId: string,
  usedAt: Date
): Promise<boolean> {
  const affected = await db.$executeRaw`UPDATE "entries" SET "lastUsedAt" = ${usedAt} WHERE "id" = ${id} AND "userId" = ${userId}`;
  return affected > 0;
}
