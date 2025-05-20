import { type NextFunction, type Response } from 'express';

import { type AuthRequest } from '../types';
import { UnauthorizedError, ForbiddenError, jwtUtil } from '../utils';

// Verify JWT token from Authorization header
export const authenticate = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwtUtil.verifyToken(token);

    if (!decoded.success || !decoded.data) {
      throw new UnauthorizedError('Invalid token');
    }

    req.user = {
      id: decoded.data.guestId.toString(),
      username: decoded.data.username,
      role: decoded.data.role,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid token'));
  }
};

// Check if user has required role
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('User not authenticated');
      }

      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
