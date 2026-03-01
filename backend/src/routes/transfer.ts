import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimiter';

export const transferRouter = Router();
transferRouter.use(authMiddleware);

// GET /api/export - Export all encrypted data
transferRouter.get('/export', strictRateLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const userId = req.user!.userId;

    const [entries, categories] = await Promise.all([
      prisma.entry.findMany({
        where: { userId },
        include: { categories: { include: { category: true } } },
      }),
      prisma.category.findMany({ where: { userId } }),
    ]);

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      entries: entries.map(e => ({
        ...e,
        categories: e.categories.map(ec => ec.category),
      })),
      categories,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="private-key-manager-export.json"');
    res.json(exportData);
  } catch (error) {
    next(error);
  }
});

const importSchema = z.object({
  version: z.string(),
  entries: z.array(z.object({
    type: z.enum(['API_KEY', 'ACCOUNT']),
    name: z.string().min(1).max(255),
    icon: z.string().max(10).optional(),
    encryptedData: z.string().min(1),
    service: z.string().max(255).optional().nullable(),
    username: z.string().max(255).optional().nullable(),
    url: z.string().max(2048).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
    categories: z.array(z.object({ name: z.string(), color: z.string().optional() })).optional(),
  })),
  categories: z.array(z.object({
    name: z.string().min(1).max(100),
    color: z.string().optional(),
  })).optional(),
  merge: z.boolean().optional().default(false),
});

// POST /api/import - Import encrypted data
transferRouter.post('/import', strictRateLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { entries, categories, merge } = importSchema.parse(req.body);
    const userId = req.user!.userId;

    await prisma.$transaction(async (tx) => {
      if (!merge) {
        // Delete all existing data before import
        await tx.entry.deleteMany({ where: { userId } });
        await tx.category.deleteMany({ where: { userId } });
      }

      // Import categories first
      const categoryMap = new Map<string, string>();

      if (categories) {
        for (const cat of categories) {
          const existing = await tx.category.findUnique({
            where: { name_userId: { name: cat.name, userId } },
          });

          if (existing) {
            categoryMap.set(cat.name, existing.id);
          } else {
            const created = await tx.category.create({
              data: { name: cat.name, color: cat.color ?? '#6366f1', userId },
            });
            categoryMap.set(cat.name, created.id);
          }
        }
      }

      // Import entries
      for (const entry of entries) {
        const { categories: entryCats, ...entryData } = entry;

        const created = await tx.entry.create({
          data: {
            type: entryData.type,
            name: entryData.name,
            icon: entryData.icon,
            encryptedData: entryData.encryptedData,
            service: entryData.service ?? null,
            username: entryData.username ?? null,
            url: entryData.url ?? null,
            note: entryData.note ?? null,
            expiresAt: entryData.expiresAt ? new Date(entryData.expiresAt) : null,
            userId,
          },
        });

        if (entryCats && entryCats.length > 0) {
          const catIds: string[] = [];
          for (const cat of entryCats) {
            if (categoryMap.has(cat.name)) {
              catIds.push(categoryMap.get(cat.name)!);
            }
          }

          if (catIds.length > 0) {
            await tx.entryCategory.createMany({
              data: catIds.map(categoryId => ({ entryId: created.id, categoryId })),
            });
          }
        }
      }
    });

    res.json({
      message: `Import successful. ${entries.length} entries imported.`,
      imported: entries.length,
    });
  } catch (error) {
    next(error);
  }
});
