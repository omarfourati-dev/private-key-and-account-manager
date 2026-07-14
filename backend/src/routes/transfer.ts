import { Router, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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

// AES-256-GCM blobs from the client are base64(salt[32] || iv[12] || ciphertext+tag[>=16]).
// Rejecting anything shorter or non-base64 stops accidental plaintext submissions.
const MIN_ENCRYPTED_BLOB_BYTES = 60;

function isEncryptedBlob(value: string): boolean {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  const decoded = Buffer.from(value, 'base64');
  return decoded.length >= MIN_ENCRYPTED_BLOB_BYTES && decoded.toString('base64') === value;
}

const encryptedBlobSchema = z.string().min(1).refine(isEncryptedBlob, {
  message: 'encryptedData must be a client-encrypted blob',
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

const bulkImportSchema = z.object({
  source: z.enum(['apple', 'chrome']).optional(),
  categoryName: z.string().min(1).max(100).optional(),
  creates: z.array(z.object({
    type: z.literal('ACCOUNT'),
    name: z.string().min(1).max(255),
    icon: z.string().max(10).optional(),
    encryptedData: encryptedBlobSchema,
    service: z.string().max(255).optional().nullable(),
    username: z.string().max(255).optional().nullable(),
    url: z.string().max(2048).optional().nullable(),
    note: z.string().max(2000).optional().nullable(),
  })).max(500),
  updates: z.array(z.object({
    id: z.string().uuid(),
    encryptedData: encryptedBlobSchema,
    url: z.string().max(2048).optional(),
    note: z.string().max(2000).optional(),
    service: z.string().max(255).optional(),
  })).max(500),
}).refine(d => d.creates.length + d.updates.length > 0, { message: 'Nothing to import' });

const BULK_IMPORT_TX_TIMEOUT_MS = 30_000;

// POST /api/import/bulk - Batch create/update pre-encrypted entries (CSV smart merge)
transferRouter.post('/import/bulk', strictRateLimiter, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { categoryName, creates, updates } = bulkImportSchema.parse(req.body);
    const userId = req.user!.userId;

    if (updates.length > 0) {
      // type filter: the CSV merge must never overwrite an API_KEY blob,
      // even if a buggy client sends such an id
      const owned = await prisma.entry.findMany({
        where: { id: { in: updates.map(u => u.id) }, userId, type: 'ACCOUNT' },
        select: { id: true },
      });
      if (owned.length !== updates.length) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      let categoryId: string | null = null;
      if (categoryName && creates.length > 0) {
        const category = await tx.category.upsert({
          where: { name_userId: { name: categoryName, userId } },
          update: {},
          create: { name: categoryName, color: '#6366f1', userId },
        });
        categoryId = category.id;
      }

      for (const entry of creates) {
        const created = await tx.entry.create({
          data: {
            type: entry.type,
            name: entry.name,
            icon: entry.icon,
            encryptedData: entry.encryptedData,
            service: entry.service ?? null,
            username: entry.username ?? null,
            url: entry.url ?? null,
            note: entry.note ?? null,
            userId,
          },
        });
        if (categoryId) {
          await tx.entryCategory.create({ data: { entryId: created.id, categoryId } });
        }
      }

      for (const update of updates) {
        const { id, ...fields } = update;
        await tx.entry.update({ where: { id }, data: fields });
      }
    }, { timeout: BULK_IMPORT_TX_TIMEOUT_MS });

    res.json({ created: creates.length, updated: updates.length });
  } catch (error) {
    // P2025: an entry was deleted between the ownership check and the update
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    next(error);
  }
});
