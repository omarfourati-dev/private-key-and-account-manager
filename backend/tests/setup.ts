import { vi } from 'vitest';

// Test-Platzhalter, damit die Suite ohne vorbereitete Umgebung laeuft. Echte Secrets
// kommen in CI und Produktion aus der Umgebung und werden hier nie ueberschrieben.
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-minimum-32-chars-long';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-minimum-32-chars-long';
process.env.NODE_ENV ||= 'test';

// Mock Prisma Client
vi.mock('../src/index', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    entry: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    entryCategory: {
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    settings: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    $connect: vi.fn(),
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}));
