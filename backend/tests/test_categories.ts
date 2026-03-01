import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { categoriesRouter } from '../src/routes/categories';
import { errorHandler } from '../src/middleware/errorHandler';
import { prisma } from '../src/index';
import { generateAccessToken } from '../src/utils/jwt';

vi.mock('../src/middleware/rateLimiter', () => ({
  generalRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = express();
app.use(express.json());
app.use('/api/categories', categoriesRouter);
app.use(errorHandler);

const userId = 'user-uuid-123';
const accessToken = generateAccessToken({ userId, email: 'test@example.com' });
const authHeader = `Bearer ${accessToken}`;

const mockCategory = {
  id: 'cat-uuid-1',
  name: 'AI Tools',
  color: '#6366f1',
  userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Categories Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/categories', () => {
    it('returns categories for authenticated user', async () => {
      vi.mocked(prisma.category.findMany).mockResolvedValue([{
        ...mockCategory,
        _count: { entries: 3 },
      }] as never);

      const res = await request(app)
        .get('/api/categories')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.categories)).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/categories', () => {
    it('creates a new category', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory);

      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', authHeader)
        .send({ name: 'AI Tools', color: '#6366f1' });

      expect(res.status).toBe(201);
      expect(res.body.category.name).toBe('AI Tools');
    });

    it('returns 409 for duplicate category name', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory);

      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', authHeader)
        .send({ name: 'AI Tools' });

      expect(res.status).toBe(409);
    });

    it('returns 422 for empty name', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', authHeader)
        .send({ name: '' });

      expect(res.status).toBe(422);
    });

    it('returns 422 for invalid color format', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', authHeader)
        .send({ name: 'Test', color: 'not-a-color' });

      expect(res.status).toBe(422);
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('returns 404 for non-existent category', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .put('/api/categories/non-existent')
        .set('Authorization', authHeader)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });

    it('updates category name successfully', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValueOnce(mockCategory).mockResolvedValueOnce(null);
      vi.mocked(prisma.category.update).mockResolvedValue({ ...mockCategory, name: 'New Name' });

      const res = await request(app)
        .put('/api/categories/cat-uuid-1')
        .set('Authorization', authHeader)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('deletes category successfully', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(mockCategory);
      vi.mocked(prisma.category.delete).mockResolvedValue(mockCategory);

      const res = await request(app)
        .delete('/api/categories/cat-uuid-1')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('returns 404 for non-existent category', async () => {
      vi.mocked(prisma.category.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/categories/non-existent')
        .set('Authorization', authHeader);

      expect(res.status).toBe(404);
    });
  });
});
