import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

export const settingsRouter = Router();
settingsRouter.use(authMiddleware);

const updateSettingsSchema = z.object({
  autoLockMins: z.number().int().min(0).max(120).optional(),
  theme: z.enum(['dark', 'light']).optional(),
});

// GET /api/settings
settingsRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!settings) {
      // Create default settings if not exist
      const created = await prisma.settings.create({
        data: { userId: req.user!.userId, autoLockMins: 15, theme: 'dark' },
      });
      res.json({ settings: created });
      return;
    }

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings
settingsRouter.put('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = updateSettingsSchema.parse(req.body);

    const settings = await prisma.settings.upsert({
      where: { userId: req.user!.userId },
      update: data,
      create: {
        userId: req.user!.userId,
        autoLockMins: data.autoLockMins ?? 15,
        theme: data.theme ?? 'dark',
      },
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/settings/data - Delete all user data (reset)
settingsRouter.delete('/data', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;

    await prisma.$transaction([
      prisma.entry.deleteMany({ where: { userId } }),
      prisma.category.deleteMany({ where: { userId } }),
    ]);

    res.json({ message: 'All data deleted successfully' });
  } catch (error) {
    next(error);
  }
});
