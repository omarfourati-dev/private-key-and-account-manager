import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { entriesRouter } from '../src/routes/entries';
import { errorHandler } from '../src/middleware/errorHandler';
import { prisma } from '../src/index';
import { generateAccessToken } from '../src/utils/jwt';
import { setEntryFavorite, markEntryUsed } from '../src/utils/entryFlags';

vi.mock('../src/middleware/rateLimiter', () => ({
  generalRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/entries', entriesRouter);
app.use(errorHandler);

const userId = 'user-uuid-123';
const authHeader = `Bearer ${generateAccessToken({ userId, email: 'test@example.com' })}`;

/** Setzt die Template-Teile eines $executeRaw-Aufrufs wieder zu einem SQL-String zusammen. */
function sqlOfCall(callIndex = 0): { sql: string; values: unknown[] } {
  const [strings, ...values] = vi.mocked(prisma.$executeRaw).mock.calls[callIndex] as unknown as [
    TemplateStringsArray,
    ...unknown[],
  ];
  return { sql: strings.join('?'), values };
}

describe('Entry-Markierungen (Favorit / zuletzt verwendet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/entries/:id/favorite', () => {
    it('schreibt mit Eigentümerprüfung im WHERE und ohne uuid-Cast', async () => {
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as never);

      const res = await request(app)
        .patch('/api/entries/entry-1/favorite')
        .set('Authorization', authHeader)
        .send({ isFavorite: true });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 'entry-1', isFavorite: true });

      const { sql, values } = sqlOfCall();
      expect(sql).toBe('UPDATE "entries" SET "isFavorite" = ? WHERE "id" = ? AND "userId" = ?');
      expect(sql).not.toContain('::uuid');
      expect(values).toEqual([true, 'entry-1', userId]);
    });

    it('liefert 404, wenn keine Zeile getroffen wurde (fremder oder fehlender Eintrag)', async () => {
      vi.mocked(prisma.$executeRaw).mockResolvedValue(0 as never);

      const res = await request(app)
        .patch('/api/entries/fremd/favorite')
        .set('Authorization', authHeader)
        .send({ isFavorite: true });

      expect(res.status).toBe(404);
    });

    it('lehnt einen Nicht-Boolean ab, ohne die Datenbank anzufassen', async () => {
      const res = await request(app)
        .patch('/api/entries/entry-1/favorite')
        .set('Authorization', authHeader)
        .send({ isFavorite: 'yes' });

      expect(res.status).toBe(422);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/entries/:id/used', () => {
    it('schreibt lastUsedAt mit Eigentümerprüfung', async () => {
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1 as never);

      const res = await request(app).post('/api/entries/entry-1/used').set('Authorization', authHeader);

      expect(res.status).toBe(200);
      const { sql, values } = sqlOfCall();
      expect(sql).toBe('UPDATE "entries" SET "lastUsedAt" = ? WHERE "id" = ? AND "userId" = ?');
      expect(values[0]).toBeInstanceOf(Date);
      expect(values.slice(1)).toEqual(['entry-1', userId]);
    });

    it('liefert 404, wenn keine Zeile getroffen wurde', async () => {
      vi.mocked(prisma.$executeRaw).mockResolvedValue(0 as never);

      const res = await request(app).post('/api/entries/fremd/used').set('Authorization', authHeader);

      expect(res.status).toBe(404);
    });
  });
});

describe('URL-Validierung (nur http/https oder leer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const base = { type: 'ACCOUNT', name: 'Test', encryptedData: 'blob' };

  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'ftp://example.com', 'kein-url'])(
    'lehnt %s beim Anlegen ab',
    async (url) => {
      const res = await request(app).post('/api/entries').set('Authorization', authHeader).send({ ...base, url });
      expect(res.status).toBe(422);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    }
  );

  it('lehnt javascript: auch beim Bearbeiten ab', async () => {
    const res = await request(app)
      .put('/api/entries/entry-1')
      .set('Authorization', authHeader)
      .send({ url: 'JavaScript:alert(1)' });
    expect(res.status).toBe(422);
    expect(prisma.entry.findUnique).not.toHaveBeenCalled();
  });

  it.each(['https://example.com/login', 'http://intranet.local:8080', '', null])(
    'akzeptiert %s beim Bearbeiten',
    async (url) => {
      vi.mocked(prisma.entry.findUnique).mockResolvedValue(null);
      const res = await request(app).put('/api/entries/entry-1').set('Authorization', authHeader).send({ url });
      // 404 heißt: Validierung bestanden, erst die Eigentümerprüfung greift
      expect(res.status).toBe(404);
    }
  );
});

/**
 * Optionaler Integrationstest gegen ein echtes Postgres.
 *
 * Läuft nur, wenn INTEGRATION_DATABASE_URL gesetzt ist und die Migrationen dort bereits
 * eingespielt wurden (`prisma migrate deploy`). Er prüft genau das, was die Mocks nicht
 * sehen können: dass das SQL in Postgres gegen die TEXT-Spalte `id` überhaupt läuft.
 */
const integrationUrl = process.env.INTEGRATION_DATABASE_URL;

describe.skipIf(!integrationUrl)('Integration: entryFlags gegen Postgres', () => {
  let db: PrismaClient;
  const owner = 'integration-owner';
  const stranger = 'integration-stranger';
  const entryId = 'integration-entry';

  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url: integrationUrl! } } });
    for (const id of [owner, stranger]) {
      await db.user.create({ data: { id, email: `${id}@example.test`, passwordHash: 'x' } });
    }
    await db.entry.create({
      data: { id: entryId, type: 'ACCOUNT', name: 'Integration', userId: owner, encryptedData: 'blob' },
    });
  });

  afterAll(async () => {
    await db.entry.deleteMany({ where: { id: entryId } });
    await db.user.deleteMany({ where: { id: { in: [owner, stranger] } } });
    await db.$disconnect();
  });

  it('setzt den Favoriten für den Eigentümer, ohne updatedAt zu verändern', async () => {
    const before = await db.entry.findUniqueOrThrow({ where: { id: entryId } });
    expect(await setEntryFavorite(db, entryId, owner, true)).toBe(true);
    const after = await db.entry.findUniqueOrThrow({ where: { id: entryId } });
    expect(after.isFavorite).toBe(true);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });

  it('trifft keinen fremden Eintrag', async () => {
    expect(await setEntryFavorite(db, entryId, stranger, false)).toBe(false);
    expect(await markEntryUsed(db, entryId, stranger, new Date())).toBe(false);
    const entry = await db.entry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.isFavorite).toBe(true);
    expect(entry.lastUsedAt).toBeNull();
  });

  it('setzt lastUsedAt für den Eigentümer', async () => {
    const usedAt = new Date('2026-01-02T03:04:05.000Z');
    expect(await markEntryUsed(db, entryId, owner, usedAt)).toBe(true);
    const entry = await db.entry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.lastUsedAt?.toISOString()).toBe(usedAt.toISOString());
  });
});
