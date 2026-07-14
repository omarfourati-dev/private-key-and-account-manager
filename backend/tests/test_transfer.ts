import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { transferRouter } from '../src/routes/transfer';
import { errorHandler } from '../src/middleware/errorHandler';
import { prisma } from '../src/index';
import { generateAccessToken } from '../src/utils/jwt';

vi.mock('../src/middleware/rateLimiter', () => ({
  generalRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api', transferRouter);
app.use(errorHandler);

const userId = 'user-uuid-123';
const accessToken = generateAccessToken({ userId, email: 'test@example.com' });
const authHeader = `Bearer ${accessToken}`;

// base64(64 bytes) — passes the encrypted-blob check (>= 60 decoded bytes, canonical base64)
const validBlob = Buffer.alloc(64, 7).toString('base64');

const entryId1 = '11111111-1111-4111-8111-111111111111';
const entryId2 = '22222222-2222-4222-8222-222222222222';

interface TxMock {
  entry: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  category: { upsert: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  entryCategory: { create: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
}

function mockTransaction(): TxMock {
  const tx: TxMock = {
    entry: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new-entry-id', ...data })),
      update: vi.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    category: {
      upsert: vi.fn().mockResolvedValue({ id: 'cat-id-1', name: 'Apple Import' }),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'cat-id-1', name: 'Apple Import' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    entryCategory: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  vi.mocked(prisma.$transaction).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(tx)
  );
  return tx;
}

describe('POST /api/import/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .send({ creates: [], updates: [] });
    expect(res.status).toBe(401);
  });

  it('returns 422 when both creates and updates are empty', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({ creates: [], updates: [] });
    expect(res.status).toBe(422);
  });

  it('returns 422 for more than 500 creates', async () => {
    const creates = Array.from({ length: 501 }, (_, i) => ({
      type: 'ACCOUNT', name: `Entry ${i}`, encryptedData: validBlob,
    }));
    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({ creates, updates: [] });
    expect(res.status).toBe(422);
  });

  it('returns 422 when encryptedData looks like plaintext', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        creates: [{ type: 'ACCOUNT', name: 'GitHub', encryptedData: 'MyPlaintextPassword123!' }],
        updates: [],
      });
    expect(res.status).toBe(422);
  });

  it('returns 422 when encryptedData is too short to be an encrypted blob', async () => {
    const shortBlob = Buffer.alloc(16, 1).toString('base64');
    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        creates: [{ type: 'ACCOUNT', name: 'GitHub', encryptedData: shortBlob }],
        updates: [],
      });
    expect(res.status).toBe(422);
  });

  it('returns 422 for type API_KEY in creates', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        creates: [{ type: 'API_KEY', name: 'Key', encryptedData: validBlob }],
        updates: [],
      });
    expect(res.status).toBe(422);
  });

  it('returns 422 for a non-uuid update id', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        creates: [],
        updates: [{ id: 'not-a-uuid', encryptedData: validBlob }],
      });
    expect(res.status).toBe(422);
  });

  it('returns 404 when an update id does not belong to the user', async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([{ id: entryId1 }] as never);

    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        creates: [],
        updates: [
          { id: entryId1, encryptedData: validBlob },
          { id: entryId2, encryptedData: validBlob },
        ],
      });
    expect(res.status).toBe(404);
  });

  it('scopes the update ownership check to ACCOUNT entries', async () => {
    // API_KEY blobs must be invisible to the CSV merge
    vi.mocked(prisma.entry.findMany).mockResolvedValue([] as never);

    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({ creates: [], updates: [{ id: entryId1, encryptedData: validBlob }] });

    expect(res.status).toBe(404);
    expect(prisma.entry.findMany).toHaveBeenCalledWith({
      where: { id: { in: [entryId1] }, userId, type: 'ACCOUNT' },
      select: { id: true },
    });
  });

  it('creates and updates entries in one batch', async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([{ id: entryId1 }] as never);
    const tx = mockTransaction();

    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        source: 'chrome',
        creates: [
          { type: 'ACCOUNT', name: 'GitHub', encryptedData: validBlob, username: 'omar', url: 'https://github.com', service: 'github.com' },
          { type: 'ACCOUNT', name: 'com.spotify.music', encryptedData: validBlob, service: 'com.spotify.music' },
        ],
        updates: [{ id: entryId1, encryptedData: validBlob }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: 2, updated: 1 });
    expect(tx.entry.create).toHaveBeenCalledTimes(2);
    expect(tx.entry.update).toHaveBeenCalledWith({
      where: { id: entryId1 },
      data: { encryptedData: validBlob },
    });
    expect(tx.category.upsert).not.toHaveBeenCalled();
  });

  it('assigns the category to created entries only', async () => {
    const tx = mockTransaction();

    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        categoryName: 'Apple Import',
        creates: [{ type: 'ACCOUNT', name: 'GitHub', encryptedData: validBlob }],
        updates: [],
      });

    expect(res.status).toBe(200);
    expect(tx.category.upsert).toHaveBeenCalledWith({
      where: { name_userId: { name: 'Apple Import', userId } },
      update: {},
      create: { name: 'Apple Import', color: '#6366f1', userId },
    });
    expect(tx.entryCategory.create).toHaveBeenCalledWith({
      data: { entryId: 'new-entry-id', categoryId: 'cat-id-1' },
    });
  });

  it('forwards fill-if-empty metadata fields on updates', async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([{ id: entryId1 }] as never);
    const tx = mockTransaction();

    const res = await request(app)
      .post('/api/import/bulk')
      .set('Authorization', authHeader)
      .send({
        creates: [],
        updates: [{
          id: entryId1,
          encryptedData: validBlob,
          url: 'https://github.com',
          note: 'from import',
          service: 'github.com',
        }],
      });

    expect(res.status).toBe(200);
    expect(tx.entry.update).toHaveBeenCalledWith({
      where: { id: entryId1 },
      data: {
        encryptedData: validBlob,
        url: 'https://github.com',
        note: 'from import',
        service: 'github.com',
      },
    });
  });
});

describe('GET /api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/export');
    expect(res.status).toBe(401);
  });

  it('exports entries and categories', async () => {
    vi.mocked(prisma.entry.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.category.findMany).mockResolvedValue([] as never);

    const res = await request(app)
      .get('/api/export')
      .set('Authorization', authHeader);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe('1.0.0');
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(Array.isArray(res.body.categories)).toBe(true);
  });
});
