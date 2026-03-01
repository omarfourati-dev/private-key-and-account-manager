import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { generalRateLimiter } from '../middleware/rateLimiter';

export const categoriesRouter = Router();
categoriesRouter.use(authMiddleware);
categoriesRouter.use(generalRateLimiter);

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
});

// GET /api/categories
categoriesRouter.get('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { userId: req.user!.userId },
      include: {
        _count: { select: { entries: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

// POST /api/categories
categoriesRouter.post('/', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, color } = createCategorySchema.parse(req.body);

    const existing = await prisma.category.findUnique({
      where: { name_userId: { name, userId: req.user!.userId } },
    });

    if (existing) {
      res.status(409).json({ error: 'A category with this name already exists' });
      return;
    }

    const category = await prisma.category.create({
      data: { name, color: color ?? '#6366f1', userId: req.user!.userId },
    });

    res.status(201).json({ category });
  } catch (error) {
    next(error);
  }
});

// PUT /api/categories/:id
categoriesRouter.put('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const data = updateCategorySchema.parse(req.body);

    const existing = await prisma.category.findUnique({
      where: { id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    if (data.name && data.name !== existing.name) {
      const nameExists = await prisma.category.findUnique({
        where: { name_userId: { name: data.name, userId: req.user!.userId } },
      });
      if (nameExists) {
        res.status(409).json({ error: 'A category with this name already exists' });
        return;
      }
    }

    const category = await prisma.category.update({ where: { id }, data });
    res.json({ category });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:id
categoriesRouter.delete('/:id', async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.category.findUnique({
      where: { id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    await prisma.category.delete({ where: { id } });
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
});
