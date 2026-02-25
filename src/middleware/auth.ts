// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    phone: string;
    session: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      session: decoded.session,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}