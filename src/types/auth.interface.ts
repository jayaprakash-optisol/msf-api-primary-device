import { type Request } from 'express';

import { type ServiceResponse } from './common.interface';
import { type Guest } from './guest.interface';

/**
 * Auth request type with user property
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    [key: string]: unknown;
  };
}

/**
 * JWT payload type
 */
export interface JwtPayload {
  guestId: string;
  username: string;
  role: string;
  [key: string]: unknown;
}

/**
 * Auth service interface
 */
export interface IAuthService {
  /**
   * Login user
   */
  login(
    username: string,
    password: string,
  ): Promise<ServiceResponse<{ user: Omit<Guest, 'password'>; token: string }>>;
}
