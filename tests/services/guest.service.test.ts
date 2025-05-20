import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { mockGuests } from '../mocks';

// Create mock functions
vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn().mockImplementation(() => Promise.resolve(true)),
  },
}));

// Create a simple mock db object with jest functions
vi.mock('../../src/config/database.config', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockGuests[0]]),
        }),
      }),
    }),
  },
}));

// Import the service (after mocks)
import { GuestService } from '../../src/services/guest.service';
import bcrypt from 'bcrypt';
import { db } from '../../src/config/database.config';
import { UnauthorizedError } from '../../src/utils/error.util';

describe('GuestService', () => {
  let guestService: GuestService;

  beforeEach(() => {
    vi.resetAllMocks();

    // Reset singleton
    // @ts-ignore
    GuestService.instance = undefined;
    guestService = GuestService.getInstance();
  });

  describe('verifyGuestCredentials', () => {
    it('should verify credentials successfully', async () => {
      // Setup mocks
      vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(true));
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockGuests[0]]),
          }),
        }),
      } as any);

      const result = await guestService.verifyGuestCredentials('john.doe1234', 'Password123!');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).not.toHaveProperty('password');
      expect(bcrypt.compare).toHaveBeenCalledWith('Password123!', mockGuests[0].password);
    });

    it('should throw UnauthorizedError when guest not found', async () => {
      // Setup mocks to return empty array (guest not found)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await expect(
        guestService.verifyGuestCredentials('invalid.username', 'password'),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when password is invalid', async () => {
      // Setup mocks
      vi.mocked(bcrypt.compare).mockImplementation(() => Promise.resolve(false));
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockGuests[0]]),
          }),
        }),
      } as any);

      await expect(
        guestService.verifyGuestCredentials('john.doe1234', 'WrongPassword'),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should handle database errors', async () => {
      // Setup mocks to throw error
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      await expect(
        guestService.verifyGuestCredentials('john.doe1234', 'Password123!'),
      ).rejects.toThrow();
    });
  });
});
