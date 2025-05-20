import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthController } from '../../src/controllers/auth.controller';
import { AuthService } from '../../src/services/auth.service';
import { mockLoginRequest } from '../mocks';
import { StatusCodes } from 'http-status-codes';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/test-utils';
import { UnauthorizedError } from '../../src/utils/error.util';

// Mock the asyncHandler middleware
vi.mock('../../src/middleware/async.middleware', () => ({
  asyncHandler: vi.fn(fn => {
    return async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }),
}));

// Mock the service layer
vi.mock('../../src/services/auth.service', () => {
  const authServiceMock = {
    login: vi.fn(),
  };

  return {
    AuthService: {
      getInstance: vi.fn(() => authServiceMock),
    },
  };
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(() => {
    vi.resetAllMocks();
    authService = AuthService.getInstance();
    controller = new AuthController();
  });

  describe('login', () => {
    it('should login guest successfully', async () => {
      // Setup mocks
      const req = createMockRequest({ body: mockLoginRequest });
      const { res, jsonSpy } = createMockResponse();
      const next = createMockNext();

      // Mock service response
      authService.login.mockResolvedValueOnce({
        success: true,
        data: {
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            username: mockLoginRequest.username,
            role: 'Stock Manager',
          },
          token: 'jwt_token',
        },
        message: 'Login successful',
      });

      // Call the controller method
      await controller.login(req, res, next);

      // Verify service was called
      expect(authService.login).toHaveBeenCalledWith(
        mockLoginRequest.username,
        mockLoginRequest.password,
      );

      // Verify response
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: 'jwt_token',
          }),
        }),
      );
    });

    it('should throw UnauthorizedError for invalid credentials', async () => {
      // Setup mocks
      const req = createMockRequest({ body: mockLoginRequest });
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock service response
      authService.login.mockResolvedValueOnce({
        success: false,
        statusCode: StatusCodes.UNAUTHORIZED,
        error: 'Invalid credentials',
      });

      // Call the controller method
      await controller.login(req, res, next);

      // Verify next was called with error
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe('Invalid credentials');
    });

    it('should throw default UnauthorizedError if error is undefined', async () => {
      // Setup mocks
      const req = createMockRequest({ body: mockLoginRequest });
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock service response with undefined error
      authService.login.mockResolvedValueOnce({
        success: false,
        statusCode: StatusCodes.UNAUTHORIZED,
        error: undefined,
      });

      // Call the controller method
      await controller.login(req, res, next);

      // Verify next was called with default error message
      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(next.mock.calls[0][0].message).toBe('Login failed');
    });

    it('should pass unexpected errors to next middleware', async () => {
      // Setup mocks
      const req = createMockRequest({ body: mockLoginRequest });
      const { res } = createMockResponse();
      const next = createMockNext();

      // Mock service to throw error
      const error = new Error('Unexpected error');
      authService.login.mockRejectedValueOnce(error);

      // Call the controller method
      await controller.login(req, res, next);

      // Verify next was called with error
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
