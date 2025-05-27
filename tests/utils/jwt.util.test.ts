import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockJwtPayload } from '../mocks';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import crypto from 'crypto';

// Use vi.hoisted to ensure the mock is available before imports
const mockEnv = vi.hoisted(() => ({
  JWT_SECRET: 'test_secret',
  JWT_EXPIRES_IN: '1h',
}));

// Mock dependencies
vi.mock('jsonwebtoken');
vi.mock('crypto');
vi.mock('../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Redis client
vi.mock('../../src/config/redis.config', () => ({
  getRedisClient: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  })),
}));

// Mock the env.config module
vi.mock('../../src/config/env.config', () => ({
  default: mockEnv,
}));

// Mock the utils module
vi.mock('../../src/utils', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import jwtUtil after mocking dependencies
import { jwtUtil } from '../../src/utils/jwt.util';

describe('JWT Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('generateToken', () => {
    it('should generate JWT token using the correct payload and options', () => {
      // Mock crypto.randomBytes
      vi.mocked(crypto.randomBytes).mockReturnValue({
        toString: () => 'mock-session-id',
      } as any);

      // Mock jwt.sign
      vi.mocked(jwt.sign).mockImplementation(() => 'mocked_token');

      // Call the function
      const token = jwtUtil.generateToken(mockJwtPayload);

      // Assert jwt.sign was called with enhanced payload and algorithm
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockJwtPayload,
          jti: 'mock-session-id',
          iat: expect.any(Number),
          exp: expect.any(Number),
        }),
        'test_secret',
        {
          algorithm: 'HS512',
        },
      );

      // Assert the returned token
      expect(token).toBe('mocked_token');
    });

    it('should throw error if JWT_SECRET is not defined', () => {
      // Save original value
      const originalJwtSecret = mockEnv.JWT_SECRET;

      // Temporarily modify the mock implementation
      mockEnv.JWT_SECRET = undefined as any;

      // Assert the function throws error
      expect(() => jwtUtil.generateToken(mockJwtPayload)).toThrow('JWT_SECRET is not defined');

      // Restore the original value
      mockEnv.JWT_SECRET = originalJwtSecret;
    });

    it('should use default expires time if JWT_EXPIRES_IN is not specified', () => {
      // Save original value
      const originalJwtExpiresIn = mockEnv.JWT_EXPIRES_IN;

      // Temporarily modify the mock implementation
      mockEnv.JWT_EXPIRES_IN = undefined as any;

      // Mock crypto.randomBytes
      vi.mocked(crypto.randomBytes).mockReturnValue({
        toString: () => 'mock-session-id',
      } as any);

      vi.mocked(jwt.sign).mockImplementation(() => 'mocked_token');

      // Call the function
      jwtUtil.generateToken(mockJwtPayload);

      // Check jwt.sign was called with the enhanced payload and algorithm
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockJwtPayload,
          jti: 'mock-session-id',
        }),
        'test_secret',
        {
          algorithm: 'HS512',
        },
      );

      // Restore the original value
      mockEnv.JWT_EXPIRES_IN = originalJwtExpiresIn;
    });

    it('should handle jwt.sign throwing an error', () => {
      // Mock crypto.randomBytes
      vi.mocked(crypto.randomBytes).mockReturnValue({
        toString: () => 'mock-session-id',
      } as any);

      // Mock jwt.sign to throw an error
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw new Error('Signing error');
      });

      // Assert the function throws error
      expect(() => jwtUtil.generateToken(mockJwtPayload)).toThrow('Signing error');
    });
  });

  describe('verifyToken', () => {
    it('should return payload if token is valid', async () => {
      // Mock jwt.verify
      vi.mocked(jwt.verify).mockImplementation(() => ({
        ...mockJwtPayload,
        jti: 'test-jti',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }));

      // Call the function
      const result = await jwtUtil.verifyToken('valid_token');

      // Assert jwt.verify was called with correct arguments
      expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');

      // Assert the returned result is the payload
      expect(result).toEqual(
        expect.objectContaining({
          guestId: mockJwtPayload.guestId,
          username: mockJwtPayload.username,
          role: mockJwtPayload.role,
          jti: 'test-jti',
        }),
      );
    });

    it('should throw error if token is expired', async () => {
      // Create a TokenExpiredError
      const tokenExpiredError = new Error('jwt expired');
      tokenExpiredError.name = 'TokenExpiredError';

      // Mock jwt.verify to throw TokenExpiredError
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw tokenExpiredError;
      });

      // Assert the function throws error
      await expect(jwtUtil.verifyToken('expired_token')).rejects.toThrow('jwt expired');
    });

    it('should throw error if token is invalid', async () => {
      // Mock jwt.verify to throw generic error
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Assert the function throws error
      await expect(jwtUtil.verifyToken('invalid_token')).rejects.toThrow('Invalid signature');
    });

    it('should throw error if JWT_SECRET is not defined', async () => {
      // Save original value
      const originalJwtSecret = mockEnv.JWT_SECRET;

      // Temporarily modify the mock implementation
      mockEnv.JWT_SECRET = undefined as any;

      // Assert the function throws error
      await expect(jwtUtil.verifyToken('valid_token')).rejects.toThrow('JWT_SECRET is not defined');

      // Restore the original value
      mockEnv.JWT_SECRET = originalJwtSecret;
    });

    it('should throw error for malformed JWT tokens', async () => {
      // Mock jwt.verify to throw JsonWebTokenError
      const jsonWebTokenError = new Error('jwt malformed');
      jsonWebTokenError.name = 'JsonWebTokenError';

      vi.mocked(jwt.verify).mockImplementation(() => {
        throw jsonWebTokenError;
      });

      // Assert the function throws error
      await expect(jwtUtil.verifyToken('malformed_token')).rejects.toThrow('jwt malformed');
    });

    it('should throw error if token is blacklisted', async () => {
      // Mock jwt.verify
      vi.mocked(jwt.verify).mockImplementation(() => ({
        ...mockJwtPayload,
        jti: 'blacklisted-jti',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }));

      // Mock isTokenBlacklisted to return true
      const isTokenBlacklistedSpy = vi.spyOn(jwtUtil, 'isTokenBlacklisted');
      isTokenBlacklistedSpy.mockResolvedValueOnce(true);

      // Assert the function throws error
      await expect(jwtUtil.verifyToken('blacklisted_token')).rejects.toThrow(
        'Token has been expired',
      );

      // Restore the spy
      isTokenBlacklistedSpy.mockRestore();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      // Mock jwt.decode
      vi.mocked(jwt.decode).mockImplementation(() => ({ ...mockJwtPayload }));

      // Call the function
      const payload = jwtUtil.decodeToken('token_to_decode');

      // Assert jwt.decode was called with correct arguments
      expect(jwt.decode).toHaveBeenCalledWith('token_to_decode');

      // Assert the returned payload
      expect(payload).toEqual(mockJwtPayload);
    });

    it('should return null if decoding fails', () => {
      // Mock jwt.decode to throw error
      vi.mocked(jwt.decode).mockImplementation(() => {
        throw new Error('Decoding error');
      });

      // Call the function
      const payload = jwtUtil.decodeToken('invalid_token');

      // Assert the returned payload is null
      expect(payload).toBeNull();
    });

    it('should return the decoded value even if it is not an object', () => {
      // Mock jwt.decode to return a string instead of an object
      vi.mocked(jwt.decode).mockImplementation(() => 'not-an-object');

      // Call the function
      const payload = jwtUtil.decodeToken('string_token');

      // Assert the returned payload matches what jwt.decode returns
      // The implementation casts to JwtPayload but doesn't validate the type
      expect(payload).toEqual('not-an-object');
    });

    it('should handle null return from jwt.decode', () => {
      // Mock jwt.decode to return null (e.g., for invalid token format)
      vi.mocked(jwt.decode).mockImplementation(() => null);

      // Call the function
      const payload = jwtUtil.decodeToken('invalid_format_token');

      // Assert the returned payload is null
      expect(payload).toBeNull();
    });
  });
});
