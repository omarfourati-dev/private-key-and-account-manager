import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { authRouter } from '../src/routes/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { prisma } from '../src/index';

vi.mock('../src/middleware/rateLimiter', () => ({
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  generalRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRouter);
app.use(errorHandler);

describe('Auth Routes', () => {
  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    passwordHash: '',
    isAdmin: false,
    isActive: true,
    googleId: null,
    appleId: null,
    encryptedVaultKey: null,
    adminEncryptedVaultKey: null,
    adminPublicKey: null,
    adminPrivateKeyEncrypted: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUser.passwordHash = await bcrypt.hash('password123', 12);
  });

  describe('GET /api/auth/status', () => {
    it('returns isSetupComplete: false when no user exists', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.isSetupComplete).toBe(false);
    });

    it('returns isSetupComplete: true when user exists', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser);
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.isSetupComplete).toBe(true);
    });
  });

  describe('POST /api/auth/setup', () => {
    it('creates user on first setup', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({
        id: 'rt-1',
        token: 'refresh-token',
        userId: mockUser.id,
        expiresAt: new Date(),
        createdAt: new Date(),
        isRevoked: false,
      });

      const res = await request(app).post('/api/auth/setup').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('returns 409 if setup already done', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser);
      const res = await request(app).post('/api/auth/setup').send({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(res.status).toBe(409);
    });

    it('returns 422 for invalid email', async () => {
      const res = await request(app).post('/api/auth/setup').send({
        email: 'not-an-email',
        password: 'password123',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 for short password', async () => {
      const res = await request(app).post('/api/auth/setup').send({
        email: 'test@example.com',
        password: 'short',
      });
      expect(res.status).toBe(422);
    });

    it('returns 422 for missing fields', async () => {
      const res = await request(app).post('/api/auth/setup').send({});
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns access token for valid credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({
        id: 'rt-1', token: 'rt', userId: mockUser.id, expiresAt: new Date(), createdAt: new Date(), isRevoked: false,
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('returns 401 for wrong password', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser);
      const res = await request(app).post('/api/auth/login').send({
        email: 'test@example.com',
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 for non-existent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@example.com',
        password: 'password123',
      });
      expect(res.status).toBe(401);
    });

    it('returns 422 for invalid email format', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'not-email',
        password: 'password123',
      });
      expect(res.status).toBe(422);
    });
  });
});
