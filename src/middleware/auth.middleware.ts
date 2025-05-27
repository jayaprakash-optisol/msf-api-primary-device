import { type NextFunction, type Response } from 'express';

import { type AuthRequest } from '../types';
import { UnauthorizedError, ForbiddenError, jwtUtil } from '../utils';

// Verify JWT token from Authorization header
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = await jwtUtil.verifyToken(token);

    // Check if decoded token has all required fields
    if (!decoded.guestId || !decoded.username || !decoded.role) {
      throw new UnauthorizedError('Invalid token');
    }

    req.user = {
      id: decoded.guestId.toString(),
      username: decoded.username,
      role: decoded.role,
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
