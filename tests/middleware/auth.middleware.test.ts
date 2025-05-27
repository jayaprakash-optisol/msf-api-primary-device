import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticate, authorize } from '../../src/middleware/auth.middleware';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/test-utils';
import { mockToken, invalidToken } from '../mocks';
import type { AuthRequest } from '../../src/types';
import { jwtUtil } from '../../src/utils/jwt.util';
import { StatusCodes } from 'http-status-codes';

// Mock dependencies
vi.mock('jsonwebtoken');
vi.mock('../../src/utils/jwt.util', () => ({
  jwtUtil: {
    verifyToken: vi.fn(),
  },
}));

describe('Auth Middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('authenticate middleware', () => {
    it('should call next() if token is valid', async () => {
      // Mock request with token
      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      }) as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock JWT verification to return success
      vi.mocked(jwtUtil.verifyToken).mockResolvedValue({
        guestId: '1',
        username: 'john.doe1234',
        role: 'Stock Manager',
      });

      // Call middleware
      await authenticate(req, res, next);

      // Should set req.user and call next
      expect(req.user).toEqual({
        id: '1',
        username: 'john.doe1234',
        role: 'Stock Manager',
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 401 if no token is provided', async () => {
      // Mock request without token
      const req = createMockRequest() as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Call middleware
      await authenticate(req, res, next);

      // Should pass error to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          statusCode: 401,
        }),
      );
    });

    it('should return 401 if Authorization header has incorrect format', async () => {
      // Mock request with invalid token format
      const req = createMockRequest({
        headers: {
          authorization: 'InvalidFormat',
        },
      }) as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Call middleware
      await authenticate(req, res, next);

      // Should pass error to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          statusCode: 401,
        }),
      );
    });

    it('should return 401 if token is invalid', async () => {
      // Mock request with invalid token
      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${invalidToken}`,
        },
      }) as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock JWT verification to fail
      vi.mocked(jwtUtil.verifyToken).mockRejectedValue(new Error('Invalid token'));

      // Call middleware
      await authenticate(req, res, next);

      // Should pass error to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          statusCode: 401,
        }),
      );
    });

    it('should pass role information from token to request', async () => {
      // Mock request with token that has role information
      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      }) as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock JWT verification to return admin role
      vi.mocked(jwtUtil.verifyToken).mockResolvedValue({
        guestId: '1',
        username: 'john.doe1234',
        role: 'Store Keeper',
      });

      // Call middleware
      await authenticate(req, res, next);

      // Should set req.user with role information
      expect(req.user).toEqual({
        id: '1',
        username: 'john.doe1234',
        role: 'Store Keeper',
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle verification errors gracefully', async () => {
      // Mock request with token
      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      }) as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock JWT verification to throw unexpected error
      vi.mocked(jwtUtil.verifyToken).mockRejectedValue(new Error('Unexpected error'));

      // Call middleware
      await authenticate(req, res, next);

      // Should pass error to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          statusCode: 401,
        }),
      );
    });

    it('should handle token verification with missing data', async () => {
      // Mock request with token
      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${mockToken}`,
        },
      }) as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock JWT verification to return success but with missing data
      vi.mocked(jwtUtil.verifyToken).mockResolvedValue({
        // Missing required fields like guestId, username, role
      } as any);

      // Call middleware
      await authenticate(req, res, next);

      // Should pass error to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid token',
          statusCode: 401,
        }),
      );
    });
  });

  describe('authorize middleware', () => {
    it('should call next() if user has required role', () => {
      // Mock request with user having 'Stock Manager' role
      const req = createMockRequest() as AuthRequest;
      req.user = {
        id: '1',
        username: 'john.doe1234',
        role: 'Stock Manager',
      };
      const { res } = createMockResponse();
      const next = createMockNext();

      // Create middleware with 'Stock Manager' role requirement
      const middleware = authorize('Stock Manager');

      // Call middleware
      middleware(req, res, next);

      // Should call next without arguments
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next() if user has one of multiple required roles', () => {
      // Mock request with user having 'Store Keeper' role
      const req = createMockRequest() as AuthRequest;
      req.user = {
        id: '1',
        username: 'jane.smith5678',
        role: 'Store Keeper',
      };
      const { res } = createMockResponse();
      const next = createMockNext();

      // Create middleware with multiple role requirements
      const middleware = authorize('Stock Manager', 'Store Keeper');

      // Call middleware
      middleware(req, res, next);

      // Should call next without arguments
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 403 if user does not have required role', () => {
      // Mock request with user having 'Store Keeper' role
      const req = createMockRequest() as AuthRequest;
      req.user = {
        id: '1',
        username: 'jane.smith5678',
        role: 'Store Keeper',
      };
      const { res } = createMockResponse();
      const next = createMockNext();

      // Create middleware with 'Stock Manager' role requirement
      const middleware = authorize('Stock Manager');

      // Call middleware
      middleware(req, res, next);

      // Should pass error to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Insufficient permissions',
          statusCode: 403,
        }),
      );
    });

    it('should return 401 if user is not authenticated', () => {
      // Mock request without user
      const req = createMockRequest() as AuthRequest;
      const { res } = createMockResponse();
      const next = createMockNext();

      // Create middleware with role requirement
      const middleware = authorize('Stock Manager');

      // Call middleware
      middleware(req, res, next);

      // Should pass error to next
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User not authenticated',
          statusCode: 401,
        }),
      );
    });
  });
});
