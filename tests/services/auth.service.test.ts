import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/auth.service';
import { mockGuests } from '../mocks';
import { StatusCodes } from 'http-status-codes';
import { UnauthorizedError } from '../../src/utils/error.util';

// Mock implementation - use vi.hoisted to ensure they're available before imports
const mockVerifyGuestCredentials = vi.fn();
const mockGenerateToken = vi.hoisted(() => vi.fn().mockReturnValue('mock_token'));
const mockRevokeToken = vi.hoisted(() => vi.fn());

// Import mocked dependencies
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockImplementation(() => Promise.resolve(true)),
  },
}));

vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('mock_token'),
}));

vi.mock('../../src/utils/jwt.util', () => ({
  jwtUtil: {
    generateToken: mockGenerateToken,
    revokeToken: mockRevokeToken,
  },
}));

// Mock authResponse
vi.mock('../../src/utils/responseMessages/auth.messages', () => ({
  authResponse: {
    errors: {
      invalidCredentials: 'Authentication failed: Invalid credentials',
      loginFailed: 'Login failed',
      logoutFailed: 'Logout failed',
    },
    success: {
      loggedIn: 'Guest logged in successfully',
      loggedOut: 'Logged out successfully',
    },
  },
}));

// Mock GuestService
vi.mock('../../src/services/guest.service', () => ({
  GuestService: {
    getInstance: vi.fn(() => ({
      verifyGuestCredentials: mockVerifyGuestCredentials,
    })),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();
    // Reset singleton instance for clean testing
    // @ts-ignore - accessing private static field for testing
    AuthService.instance = undefined;
    authService = AuthService.getInstance();
  });

  describe('login', () => {
    it('should login guest successfully with valid credentials', async () => {
      // Mock verifyGuestCredentials to return success
      mockVerifyGuestCredentials.mockResolvedValueOnce({
        success: true,
        data: mockGuests[0],
        message: 'Credentials verified successfully',
      });

      // Just check basic functionality works
      const result = await authService.login('john.doe1234', 'Password123!');
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data!).toHaveProperty('token');
      expect(result.data!).toHaveProperty('user');
      expect(result.data!.user).toHaveProperty('username', 'john.doe1234');
    });

    it('should handle unauthorized errors for invalid credentials', async () => {
      // Return unauthorized error response
      mockVerifyGuestCredentials.mockResolvedValueOnce({
        success: false,
        error: 'Invalid credentials',
        statusCode: StatusCodes.UNAUTHORIZED,
      });

      // Test for unauthorized error
      const promise = authService.login('john.doe1234', 'WrongPassword');
      await expect(promise).rejects.toThrow(UnauthorizedError);
      await expect(promise).rejects.toThrow('Invalid credentials');
    });

    it('should throw an error when verifyGuestCredentials returns success but no data', async () => {
      // Mock verification with success but no data
      mockVerifyGuestCredentials.mockResolvedValueOnce({
        success: true,
        data: null,
        statusCode: StatusCodes.OK,
      });

      // Test that an error is thrown
      const promise = authService.login('john.doe1234', 'Password123!');
      await expect(promise).rejects.toThrow(UnauthorizedError);
      await expect(promise).rejects.toThrow('Authentication failed: Invalid credentials');
    });

    it('should handle unexpected errors', async () => {
      // Simplified error test
      mockVerifyGuestCredentials.mockRejectedValueOnce(new Error('Test error'));

      // Just test that some error is thrown
      await expect(authService.login('john.doe1234', 'Password123!')).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      // Mock revokeToken to resolve successfully
      mockRevokeToken.mockResolvedValueOnce(undefined);

      // Call logout
      const result = await authService.logout('mock_token');

      // Verify the result
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'Logged out successfully');
      expect(result).toHaveProperty('data', null);

      // Verify revokeToken was called with the correct token
      expect(mockRevokeToken).toHaveBeenCalledWith('mock_token');
    });

    it('should handle errors during logout', async () => {
      // Mock revokeToken to throw an error
      mockRevokeToken.mockRejectedValueOnce(new Error('Test error'));

      // Test that an error is thrown
      const promise = authService.logout('mock_token');
      await expect(promise).rejects.toThrow();
      await expect(promise).rejects.toThrow('Logout failed');

      // Verify revokeToken was called with the correct token
      expect(mockRevokeToken).toHaveBeenCalledWith('mock_token');
    });
  });
});
