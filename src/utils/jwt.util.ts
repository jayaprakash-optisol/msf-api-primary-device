import { StatusCodes } from 'http-status-codes';
import jwt, { type SignOptions } from 'jsonwebtoken';

import env from '../config/env.config';
import { type IJwtUtil, type JwtPayload, type ServiceResponse } from '../types';

import { logger } from './logger';
import { createServiceResponse } from './response.util';

/**
 * JWT utility functions for token generation and verification
 */
export class JwtUtil implements IJwtUtil {
  /**
   * Generate a JWT token
   * @param payload The data to be included in the token
   * @returns The signed JWT token
   */
  generateToken(payload: JwtPayload): string {
    try {
      if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
      }

      // Using JWT_EXPIRES_IN as seconds (86400 = 24 hours)
      const expiresIn = env.JWT_EXPIRES_IN;

      const options: SignOptions = { expiresIn } as SignOptions;
      return jwt.sign(payload, env.JWT_SECRET, options);
    } catch (error) {
      logger.error('Error generating JWT token:', error);
      throw error;
    }
  }

  /**
   * Verify a JWT token
   * @param token The token to verify
   * @returns The decoded token payload or error
   */
  verifyToken(token: string): ServiceResponse<JwtPayload> {
    try {
      if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      return createServiceResponse(true, decoded);
    } catch (error) {
      logger.error('Error verifying JWT token:', error);

      // Empty JwtPayload object for error case
      const emptyPayload: JwtPayload = { guestId: '', username: '', role: '' };

      // Handle specific token errors
      if ((error as Error)?.name === 'TokenExpiredError') {
        return createServiceResponse(
          false,
          emptyPayload,
          'Token expired',
          StatusCodes.UNAUTHORIZED,
        );
      }

      return createServiceResponse(
        false,
        emptyPayload,
        (error as Error).message || 'Invalid token',
        StatusCodes.UNAUTHORIZED,
      );
    }
  }

  /**
   * Decode a JWT token without verification
   * @param token The token to decode
   * @returns The decoded token payload
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch (error) {
      logger.error('Error decoding JWT token:', error);
      return null;
    }
  }
}

// Create singleton instance
export const jwtUtil = new JwtUtil();
