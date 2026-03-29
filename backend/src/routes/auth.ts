import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../index';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../utils/jwt';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const setupSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password is required').max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
  reEncryptedEntries: z.array(z.object({
    id: z.string().uuid(),
    encryptedData: z.string(),
  })).optional(),
});

// POST /api/auth/setup - One-time initial setup
authRouter.post('/setup', authRateLimiter, async (req, res: Response, next) => {
  try {
    const { email, password } = setupSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst();
    if (existingUser) {
      res.status(409).json({ error: 'Setup already completed. Only one user account is allowed.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        settings: {
          create: {
            autoLockMins: 15,
            theme: 'dark',
          },
        },
      },
    });

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const { token: refreshToken } = generateRefreshToken({ userId: user.id, email: user.email });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.status(201).json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login
authRouter.post('/login', authRateLimiter, async (req, res: Response, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });

    // Constant-time comparison to prevent timing attacks
    const dummyHash = '$2b$12$invalidhashfortimingequalitycheck';
    const passwordHash = user?.passwordHash ?? dummyHash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !isValid) {
      logger.warn('Failed login attempt', { email });
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const { token: refreshToken } = generateRefreshToken({ userId: user.id, email: user.email });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    logger.info('User logged in', { userId: user.id });
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, COOKIE_OPTIONS);
    res.json({ accessToken, user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res: Response, next) => {
  try {
    const token = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

    if (!token) {
      res.status(401).json({ error: 'No refresh token provided' });
      return;
    }

    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const storedToken = await prisma.refreshToken.findUnique({ where: { token } });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      res.status(401).json({ error: 'Refresh token is invalid or expired' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      res.clearCookie(REFRESH_TOKEN_COOKIE);
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Rotate refresh token
    await prisma.refreshToken.update({ where: { id: storedToken.id }, data: { isRevoked: true } });

    const newAccessToken = generateAccessToken({ userId: user.id, email: user.email });
    const { token: newRefreshToken } = generateRefreshToken({ userId: user.id, email: user.email });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt: getRefreshTokenExpiry(),
      },
    });

    res.cookie(REFRESH_TOKEN_COOKIE, newRefreshToken, COOKIE_OPTIONS);
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const token = req.cookies[REFRESH_TOKEN_COOKIE] as string | undefined;

    if (token) {
      await prisma.refreshToken.updateMany({
        where: { token },
        data: { isRevoked: true },
      });
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout-all
authRouter.post('/logout-all', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.userId, isRevoked: false },
      data: { isRevoked: true },
    });

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    res.json({ message: 'All sessions terminated' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/auth/password
authRouter.put('/password', authRateLimiter, authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { currentPassword, newPassword, reEncryptedEntries } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({ error: 'OAuth users must set a password via the Set Password option first.' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      });

      if (reEncryptedEntries && reEncryptedEntries.length > 0) {
        for (const entry of reEncryptedEntries) {
          await tx.entry.update({
            where: { id: entry.id, userId: user.id },
            data: { encryptedData: entry.encryptedData },
          });
        }
      }

      // Revoke all refresh tokens to force re-login
      await tx.refreshToken.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    res.clearCookie(REFRESH_TOKEN_COOKIE);
    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/sessions
authRouter.get('/sessions', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where: {
        userId: req.user!.userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/sessions/:id - Revoke a specific session
authRouter.delete('/sessions/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const token = await prisma.refreshToken.findUnique({ where: { id } });
    if (!token || token.userId !== req.user!.userId) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });

    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/status
authRouter.get('/status', async (_req, res: Response, next) => {
  try {
    const userExists = await prisma.user.findFirst({ select: { id: true } });
    res.json({ isSetupComplete: !!userExists });
  } catch (error) {
    next(error);
  }
});
