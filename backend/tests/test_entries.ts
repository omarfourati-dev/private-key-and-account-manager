import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { entriesRouter } from '../src/routes/entries';
import { errorHandler } from '../src/middleware/errorHandler';
import { prisma } from '../src/index';
import { generateAccessToken } from '../src/utils/jwt';

vi.mock('../src/middleware/rateLimiter', () => ({
  generalRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/entries', entriesRouter);
app.use(errorHandler);

const userId = 'user-uuid-123';
const accessToken = generateAccessToken({ userId, email: 'test@example.com' });
const authHeader = `Bearer ${accessToken}`;

const mockEntry = {
  id: 'entry-uuid-1',
  type: 'API_KEY' as const,
  name: 'OpenAI Key',
  icon: '🤖',
  userId,
  service: 'OpenAI',
  username: null,
  url: null,
  note: 'Production key',
  expiresAt: null,
  encryptedData: 'encrypted-base64-data',
  createdAt: new Date(),
  updatedAt: new Date(),
  categories: [],
};

describe('Entries Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/entries', () => {
    it('returns entries for authenticated user', async () => {
      vi.mocked(prisma.entry.findMany).mockResolvedValue([{ ...mockEntry, categories: [] }] as never);

      const res = await request(app)
        .get('/api/entries')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.entries)).toBe(true);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/entries');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/entries')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/entries', () => {
    it('creates entry successfully', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => {
        return fn({
          ...prisma,
          entry: {
            ...prisma.entry,
            create: vi.fn().mockResolvedValue(mockEntry),
            findUnique: vi.fn().mockResolvedValue({ ...mockEntry, categories: [] }),
          },
          category: {
            ...prisma.category,
            findMany: vi.fn().mockResolvedValue([]),
          },
          entryCategory: {
            createMany: vi.fn().mockResolvedValue({ count: 0 }),
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        } as typeof prisma);
      });

      const res = await request(app)
        .post('/api/entries')
        .set('Authorization', authHeader)
        .send({
          type: 'API_KEY',
          name: 'OpenAI Key',
          icon: '🤖',
          encryptedData: 'base64EncryptedString',
          service: 'OpenAI',
        });

      expect(res.status).toBe(201);
    });

    it('returns 422 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/entries')
        .set('Authorization', authHeader)
        .send({ name: 'Missing type and encryptedData' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid entry type', async () => {
      const res = await request(app)
        .post('/api/entries')
        .set('Authorization', authHeader)
        .send({ type: 'INVALID', name: 'Test', encryptedData: 'data' });

      expect(res.status).toBe(422);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/entries')
        .send({ type: 'API_KEY', name: 'Test', encryptedData: 'data' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/entries/:id', () => {
    it('returns 404 for non-existent entry', async () => {
      vi.mocked(prisma.entry.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/entries/non-existent-id')
        .set('Authorization', authHeader)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/entries/:id', () => {
    it('deletes entry for owner', async () => {
      vi.mocked(prisma.entry.findUnique).mockResolvedValue(mockEntry);
      vi.mocked(prisma.entry.delete).mockResolvedValue(mockEntry);

      const res = await request(app)
        .delete('/api/entries/entry-uuid-1')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('returns 404 for non-existent entry', async () => {
      vi.mocked(prisma.entry.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/entries/non-existent')
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/entries/some-id');
      expect(res.status).toBe(401);
    });
  });
});
