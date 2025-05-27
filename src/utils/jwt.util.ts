import jwt from 'jsonwebtoken';

import { type IJwtUtil, type JwtPayload } from '../types';

import { logger } from './logger';
import { getRedisClient } from '../config/redis.config';
import crypto from 'crypto';
import env from '../config/env.config';

/**
 * JWT utility functions for token generation and verification
 */
export class JwtUtil implements IJwtUtil {
  private readonly BLACKLIST_PREFIX = 'jwt_blacklist:';
  private readonly SESSION_PREFIX = 'jwt_session:';

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const result = await redis.get(this.getBlacklistKey(jti));
      return result !== null;
    } catch (error) {
      logger.error('Error checking token blacklist:', error);
      // Fail secure - if Redis is down, consider token invalid
      return true;
    }
  }

  /**
   * Blacklist a token
   */
  async blacklistToken(jti: string, expiresAt: number): Promise<void> {
    try {
      const redis = getRedisClient();
      const ttl = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));

      if (ttl > 0) {
        await redis.setex(this.getBlacklistKey(jti), ttl, 'blacklisted');
      }
    } catch (error) {
      logger.error('Error blacklisting token:', error);
      throw error;
    }
  }

  /**
   * Store active session
   */
  async storeSession(userId: string, jti: string, expiresAt: number): Promise<void> {
    try {
      const redis = getRedisClient();
      const sessionKey = this.getSessionKey(userId);
      const ttl = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));

      if (ttl > 0) {
        await redis.setex(sessionKey, ttl, jti);
      }
    } catch (error) {
      logger.error('Error storing session:', error);
      throw error;
    }
  }

  /**
   * Invalidate all sessions for a user
   */
  async invalidateUserSessions(userId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const sessionKey = this.getSessionKey(userId);

      // Get current session token
      const currentJti = await redis.get(sessionKey);

      if (currentJti) {
        // Blacklist the current token
        const decoded = this.decodeToken(currentJti);
        if (decoded?.exp) {
          await this.blacklistToken(currentJti, decoded.exp);
        }
      }

      // Remove session
      await redis.del(sessionKey);
    } catch (error) {
      logger.error('Error invalidating user sessions:', error);
      throw error;
    }
  }

  /**
   * Generate a JWT token
   * @param payload The data to be included in the token
   * @param customExpiresIn
   * @returns The signed JWT token
   */
  generateToken(payload: JwtPayload, customExpiresIn?: string | number): string {
    try {
      const jwtSecret = env.JWT_SECRET;

      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
      }

      // Generate unique token ID for tracking
      const jti = this.generateSessionId();
      const iat = Math.floor(Date.now() / 1000);

      // Use custom expiration if provided, otherwise use JWT_EXPIRES_IN from env
      const expiresIn = customExpiresIn ?? env.JWT_EXPIRES_IN;

      // Calculate expiration timestamp
      let exp: number;
      if (typeof expiresIn === 'string') {
        // Parse string like "1h", "30m", etc.
        const regex = /^(\d+)([smhd])$/;
        const match = regex.exec(expiresIn);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2];

          const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
          exp = iat + value * multipliers[unit as keyof typeof multipliers];
        } else {
          // If it's a numeric string, parse it
          const numericValue = parseInt(expiresIn);
          if (!isNaN(numericValue)) {
            exp = iat + numericValue;
          } else {
            exp = iat + 86400; // Default 24 hours
          }
        }
      } else {
        exp = iat + expiresIn;
      }

      const enhancedPayload: JwtPayload = {
        ...payload,
        jti,
        iat,
        exp,
      };

      const token = jwt.sign(enhancedPayload, jwtSecret, {
        algorithm: 'HS512',
      });

      // Store session asynchronously (don't block token generation)
      this.storeSession(payload.guestId, jti, exp).catch(error => {
        logger.error('Failed to store session:', error);
      });
      return token;
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
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const jwtSecret = env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
      }

      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
      // Check if the token is blacklisted (if jti exists)
      if (decoded && decoded.jti) {
        const isBlacklisted = await this.isTokenBlacklisted(decoded.jti);
        if (isBlacklisted) {
          throw new Error('Token has been expired');
        }
      }
      return decoded;
    } catch (error) {
      logger.error('Error verifying JWT token:', error);
      throw error;
    }
  }

  /**
   * Synchronous token verification (for backward compatibility)
   * Note: This doesn't check blacklist - use verifyToken for security
   */
  verifyTokenSync(token: string): JwtPayload {
    try {
      const jwtSecret = env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
      }

      return jwt.verify(token, jwtSecret) as JwtPayload;
    } catch (error) {
      logger.error('Error verifying JWT token:', error);
      throw error;
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

  /**
   * Revoke a specific token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded) {
        throw new Error('Decode error');
      }
      if (decoded.jti && decoded.exp) {
        await this.blacklistToken(decoded.jti, decoded.exp);
      }
    } catch (error) {
      logger.error('Error revoking token:', error);
      throw error;
    }
  }

  /**
   * Generate a unique session ID for tracking
   */
  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get blacklist key for a token
   */
  private getBlacklistKey(jti: string): string {
    return `${this.BLACKLIST_PREFIX}${jti}`;
  }

  /**
   * Get session key for a user
   */
  private getSessionKey(userId: string): string {
    return `${this.SESSION_PREFIX}${userId}`;
  }
}

// Create singleton instance
export const jwtUtil = new JwtUtil();
