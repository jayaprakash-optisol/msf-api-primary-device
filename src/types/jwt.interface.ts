import { type JwtPayload } from './auth.interface';
import { type ServiceResponse } from './common.interface';

/**
 * JWT utility interface
 */
export interface IJwtUtil {
  /**
   * Generate a JWT token
   */
  generateToken(payload: JwtPayload): string;

  /**
   * Verify a JWT token
   */
  verifyToken(token: string): ServiceResponse<JwtPayload>;

  /**
   * Decode a JWT token without verification
   */
  decodeToken(token: string): JwtPayload | null;
}
