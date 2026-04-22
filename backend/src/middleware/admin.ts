import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthenticatedRequest } from './auth';

export async function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { isAdmin: true, isActive: true },
    });

    if (!user || !user.isActive || !user.isAdmin) {
      res.status(403).json({ error: 'Forbidden: admin access required' });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
