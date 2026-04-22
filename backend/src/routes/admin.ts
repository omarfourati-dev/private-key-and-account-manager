import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';

export const adminRouter = Router();
adminRouter.use(authMiddleware);
adminRouter.use(adminMiddleware);

const inviteSchema = z.object({
  email: z.string().email().optional(),
});

const patchUserSchema = z.object({
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/stats
adminRouter.get('/stats', async (_req, res: Response, next) => {
  try {
    const [userCount, entryCount, categoryCount, activeSessionCount] = await Promise.all([
      prisma.user.count(),
      prisma.entry.count(),
      prisma.category.count(),
      prisma.refreshToken.count({ where: { isRevoked: false, expiresAt: { gt: new Date() } } }),
    ]);

    res.json({ userCount, entryCount, categoryCount, activeSessionCount });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users
adminRouter.get('/users', async (_req, res: Response, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isAdmin: true,
        isActive: true,
        googleId: true,
        createdAt: true,
        _count: { select: { entries: true, refreshTokens: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const result = await Promise.all(users.map(async (u) => {
      const activeSessions = await prisma.refreshToken.count({
        where: { userId: u.id, isRevoked: false, expiresAt: { gt: now } },
      });
      return { ...u, activeSessions };
    }));

    res.json({ users: result });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id
adminRouter.patch('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = patchUserSchema.parse(req.body);

    if (id === req.user!.userId && data.isAdmin === false) {
      res.status(400).json({ error: 'Cannot remove your own admin rights' });
      return;
    }
    if (id === req.user!.userId && data.isActive === false) {
      res.status(400).json({ error: 'Cannot deactivate your own account' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, isAdmin: true, isActive: true },
    });

    if (data.isActive === false) {
      await prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    res.json({ user: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    if (id === req.user!.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/sessions
adminRouter.get('/sessions', async (_req, res: Response, next) => {
  try {
    const sessions = await prisma.refreshToken.findMany({
      where: { isRevoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/sessions/:id
adminRouter.delete('/sessions/:id', async (_req, res: Response, next) => {
  try {
    const { id } = _req.params;

    const session = await prisma.refreshToken.findUnique({ where: { id } });
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    await prisma.refreshToken.update({ where: { id }, data: { isRevoked: true } });
    res.json({ message: 'Session revoked' });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/invites
adminRouter.get('/invites', async (_req, res: Response, next) => {
  try {
    const invites = await prisma.inviteToken.findMany({
      where: { usedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        token: true,
        email: true,
        createdAt: true,
        expiresAt: true,
        creator: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invites });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/invites
adminRouter.post('/invites', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { email } = inviteSchema.parse(req.body);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.inviteToken.create({
      data: { token, email: email ?? null, createdBy: req.user!.userId, expiresAt },
    });

    const inviteUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/invite/${invite.token}`;
    res.status(201).json({ invite: { ...invite, url: inviteUrl } });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/invites/:id
adminRouter.delete('/invites/:id', async (_req, res: Response, next) => {
  try {
    const { id } = _req.params;

    const invite = await prisma.inviteToken.findUnique({ where: { id } });
    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }

    await prisma.inviteToken.delete({ where: { id } });
    res.json({ message: 'Invite deleted' });
  } catch (error) {
    next(error);
  }
});
