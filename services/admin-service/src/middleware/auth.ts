import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface AuthenticatedRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name: string;
  };
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ 
        ok: false, 
        error: 'Access token required' 
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { adminId: string };
    
    // Verify admin still exists and is active
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, email: true, name: true, isActive: true }
    });

    if (!admin || !admin.isActive) {
      res.status(401).json({ 
        ok: false, 
        error: 'Invalid or inactive admin account' 
      });
      return;
    }

    req.admin = {
      id: admin.id,
      email: admin.email,
      name: admin.name
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ 
      ok: false, 
      error: 'Invalid token' 
    });
  }
}
