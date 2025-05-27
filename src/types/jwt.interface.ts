import { type JwtPayload } from './auth.interface';

/**
 * JWT utility interface
 */
export interface IJwtUtil {
  /**
   * Generate a JWT token
   * @param payload The data to be included in the token
   * @param customExpiresIn Optional custom expiration time that overrides the default
   * @returns The signed JWT token
   */
  generateToken(payload: JwtPayload, customExpiresIn?: string | number): string;

  /**
   * Verify a JWT token with blacklist checking
   * @param token The token to verify
   * @returns The decoded token payload
   * @throws Error if token is invalid, expired, or blacklisted
   */
  verifyToken(token: string): Promise<JwtPayload>;

  /**
   * Synchronous token verification (for backward compatibility)
   * Note: This doesn't check blacklist - use verifyToken for security
   */
  verifyTokenSync(token: string): JwtPayload;

  /**
   * Decode a JWT token without verification
   */
  decodeToken(token: string): JwtPayload | null;

  /**
   * Check if a token is blacklisted
   */
  isTokenBlacklisted(jti: string): Promise<boolean>;

  /**
   * Blacklist a token
   */
  blacklistToken(jti: string, expiresAt: number): Promise<void>;

  /**
   * Invalidate all sessions for a user
   */
  invalidateUserSessions(userId: string): Promise<void>;

  /**
   * Revoke a specific token
   */
  revokeToken(token: string): Promise<void>;
}
