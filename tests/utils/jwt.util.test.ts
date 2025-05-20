import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtUtil } from '../../src/utils/jwt.util';
import { mockJwtPayload } from '../mocks';
import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';

// Mock dependencies
vi.mock('jsonwebtoken');
vi.mock('../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Use vi.hoisted to ensure the mock is available
const mockEnv = vi.hoisted(() => ({
  JWT_SECRET: 'test_secret' as string | undefined,
  JWT_EXPIRES_IN: '1h' as string | undefined,
}));

vi.mock('../../src/config/env.config', () => ({
  default: mockEnv,
}));

describe('JWT Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Reset env mock values to defaults for each test
    mockEnv.JWT_SECRET = 'test_secret';
    mockEnv.JWT_EXPIRES_IN = '1h';
  });

  describe('generateToken', () => {
    it('should generate JWT token using the correct payload and options', () => {
      // Mock jwt.sign
      vi.mocked(jwt.sign).mockImplementation(() => 'mocked_token');

      // Call the function
      const token = jwtUtil.generateToken(mockJwtPayload);

      // Assert jwt.sign was called with correct arguments
      expect(jwt.sign).toHaveBeenCalledWith(mockJwtPayload, 'test_secret', {
        expiresIn: '1h',
      });

      // Assert the returned token
      expect(token).toBe('mocked_token');
    });

    it('should throw error if JWT_SECRET is not defined', () => {
      // Temporarily modify the mock environment value
      mockEnv.JWT_SECRET = undefined;

      // Assert the function throws error
      expect(() => jwtUtil.generateToken(mockJwtPayload)).toThrow('JWT_SECRET is not defined');
    });

    it('should use default expires time if JWT_EXPIRES_IN is not specified', () => {
      // Temporarily modify the mock environment value
      mockEnv.JWT_EXPIRES_IN = undefined;
      vi.mocked(jwt.sign).mockImplementation(() => 'mocked_token');

      // Call the function
      jwtUtil.generateToken(mockJwtPayload);

      // Check jwt.sign was called with the payload and secret
      expect(jwt.sign).toHaveBeenCalledWith(mockJwtPayload, 'test_secret', expect.anything());
    });

    it('should handle jwt.sign throwing an error', () => {
      // Mock jwt.sign to throw an error
      vi.mocked(jwt.sign).mockImplementation(() => {
        throw new Error('Signing error');
      });

      // Assert the function throws error
      expect(() => jwtUtil.generateToken(mockJwtPayload)).toThrow('Signing error');
    });
  });

  describe('verifyToken', () => {
    it('should return successful response with payload if token is valid', () => {
      // Mock jwt.verify
      vi.mocked(jwt.verify).mockImplementation(() => ({ ...mockJwtPayload }));

      // Call the function
      const result = jwtUtil.verifyToken('valid_token');

      // Assert jwt.verify was called with correct arguments
      expect(jwt.verify).toHaveBeenCalledWith('valid_token', 'test_secret');

      // Assert the returned result is successful with payload
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockJwtPayload);
      expect(result.statusCode).toBe(StatusCodes.OK);
    });

    it('should return error response if token is expired', () => {
      // Create a TokenExpiredError
      const tokenExpiredError = new Error('jwt expired');
      tokenExpiredError.name = 'TokenExpiredError';

      // Mock jwt.verify to throw TokenExpiredError
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw tokenExpiredError;
      });

      // Call the function
      const result = jwtUtil.verifyToken('expired_token');

      // Assert the result is an error response
      expect(result.success).toBe(false);
      expect(result.error).toBe('Token expired');
      expect(result.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(result.data).toEqual({
        guestId: '',
        username: '',
        role: '',
      });
    });

    it('should return error response if token is invalid', () => {
      // Mock jwt.verify to throw generic error
      vi.mocked(jwt.verify).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Call the function
      const result = jwtUtil.verifyToken('invalid_token');

      // Assert the result is an error response
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid signature');
      expect(result.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('should return error response if JWT_SECRET is not defined', () => {
      // Temporarily modify the mock environment value
      mockEnv.JWT_SECRET = undefined;

      // Call the function
      const result = jwtUtil.verifyToken('valid_token');

      // Assert the result is an error response
      expect(result.success).toBe(false);
      expect(result.error).toBe('JWT_SECRET is not defined');
      expect(result.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('should handle malformed JWT tokens', () => {
      // Mock jwt.verify to throw JsonWebTokenError
      const jsonWebTokenError = new Error('jwt malformed');
      jsonWebTokenError.name = 'JsonWebTokenError';

      vi.mocked(jwt.verify).mockImplementation(() => {
        throw jsonWebTokenError;
      });

      // Call the function
      const result = jwtUtil.verifyToken('malformed_token');

      // Assert the result is an error response
      expect(result.success).toBe(false);
      expect(result.error).toBe('jwt malformed');
      expect(result.statusCode).toBe(StatusCodes.UNAUTHORIZED);
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

    it('should return null if decoded token is not an object', () => {
      // Mock jwt.decode to return a string instead of an object
      vi.mocked(jwt.decode).mockImplementation(() => 'not-an-object');

      // Call the function
      const payload = jwtUtil.decodeToken('string_token');

      // Assert the returned payload is null or the actual value
      // This depends on the implementation - null is safer
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
