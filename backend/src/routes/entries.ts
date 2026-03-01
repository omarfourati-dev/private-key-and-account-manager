import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { generalRateLimiter } from '../middleware/rateLimiter';

export const entriesRouter = Router();
entriesRouter.use(authMiddleware);
entriesRouter.use(generalRateLimiter);

const createEntrySchema = z.object({
  type: z.enum(['API_KEY', 'ACCOUNT']),
  name: z.string().min(1, 'Name is required').max(255),
  icon: z.string().max(10).optional(),
  encryptedData: z.string().min(1, 'Encrypted data is required'),
  service: z.string().max(255).optional(),
  username: z.string().max(255).optional(),
  url: z.string().url('Invalid URL format').max(2048).optional().or(z.literal('')),
  note: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

const updateEntrySchema = createEntrySchema.partial();

// GET /api/entries
entriesRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { search, type, categoryId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const where: Record<string, unknown> = { userId: req.user!.userId };

    if (type && (type === 'API_KEY' || type === 'ACCOUNT')) {
      where['type'] = type;
    }

    if (search && typeof search === 'string') {
      const searchTerm = search.trim();
      where['OR'] = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { service: { contains: searchTerm, mode: 'insensitive' } },
        { username: { contains: searchTerm, mode: 'insensitive' } },
        { url: { contains: searchTerm, mode: 'insensitive' } },
        { note: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    if (categoryId && typeof categoryId === 'string') {
      where['categories'] = {
        some: { categoryId },
      };
    }

    const validSortFields = ['createdAt', 'updatedAt', 'name'];
    const sortField = validSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const entries = await prisma.entry.findMany({
      where,
      include: {
        categories: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { [sortField]: order },
    });

    res.json({
      entries: entries.map(entry => ({
        ...entry,
        categories: entry.categories.map(ec => ec.category),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/entries
entriesRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const data = createEntrySchema.parse(req.body);
    const { categoryIds, ...entryData } = data;

    const entry = await prisma.$transaction(async (tx) => {
      const newEntry = await tx.entry.create({
        data: {
          ...entryData,
          expiresAt: entryData.expiresAt ? new Date(entryData.expiresAt) : null,
          userId: req.user!.userId,
          url: entryData.url || null,
        },
      });

      if (categoryIds && categoryIds.length > 0) {
        // Verify categories belong to user
        const validCategories = await tx.category.findMany({
          where: { id: { in: categoryIds }, userId: req.user!.userId },
        });

        await tx.entryCategory.createMany({
          data: validCategories.map(c => ({ entryId: newEntry.id, categoryId: c.id })),
        });
      }

      return tx.entry.findUnique({
        where: { id: newEntry.id },
        include: { categories: { include: { category: true } } },
      });
    });

    res.status(201).json({
      entry: {
        ...entry,
        categories: entry?.categories.map(ec => ec.category) ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/entries/:id
entriesRouter.put('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateEntrySchema.parse(req.body);
    const { categoryIds, ...entryData } = data;

    const existing = await prisma.entry.findUnique({ where: { id, userId: req.user!.userId } });
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    const entry = await prisma.$transaction(async (tx) => {
      const updated = await tx.entry.update({
        where: { id },
        data: {
          ...entryData,
          expiresAt: entryData.expiresAt !== undefined
            ? (entryData.expiresAt ? new Date(entryData.expiresAt) : null)
            : undefined,
          url: entryData.url !== undefined ? (entryData.url || null) : undefined,
        },
      });

      if (categoryIds !== undefined) {
        await tx.entryCategory.deleteMany({ where: { entryId: id } });

        if (categoryIds.length > 0) {
          const validCategories = await tx.category.findMany({
            where: { id: { in: categoryIds }, userId: req.user!.userId },
          });

          await tx.entryCategory.createMany({
            data: validCategories.map(c => ({ entryId: updated.id, categoryId: c.id })),
          });
        }
      }

      return tx.entry.findUnique({
        where: { id: updated.id },
        include: { categories: { include: { category: true } } },
      });
    });

    res.json({
      entry: {
        ...entry,
        categories: entry?.categories.map(ec => ec.category) ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/entries/:id
entriesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.entry.findUnique({ where: { id, userId: req.user!.userId } });
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    await prisma.entry.delete({ where: { id } });
    res.json({ message: 'Entry deleted successfully' });
  } catch (error) {
    next(error);
  }
});
