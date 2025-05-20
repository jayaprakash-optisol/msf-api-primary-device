import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../config/database.config';
import { guests } from '../models';
import { type Guest, type IGuestService, type ServiceResponse } from '../types';
import { _ok, handleServiceError, authResponse, UnauthorizedError } from '../utils';

export class GuestService implements IGuestService {
  private static instance: GuestService;
  private constructor() {}

  public static getInstance(): GuestService {
    if (!GuestService.instance) GuestService.instance = new GuestService();
    return GuestService.instance;
  }

  /**
   * Verify guest credentials
   * @param username - The username of the guest to verify the password for
   * @param password - The password of the guest to verify
   * @returns A service response containing the guest
   */
  async verifyGuestCredentials(
    username: string,
    password: string,
  ): Promise<ServiceResponse<Omit<Guest, 'password'>>> {
    try {
      // Get user by email with password
      const result = await db.select().from(guests).where(eq(guests.username, username)).limit(1);
      if (!result.length) throw new UnauthorizedError(authResponse.errors.invalidCredentials);

      const guest = result[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, guest.password);

      if (!isPasswordValid) {
        throw new UnauthorizedError(authResponse.errors.invalidCredentials);
      }

      // Return guest without password
      const { password: _, ...guestWithoutPassword } = guest;
      return _ok(guestWithoutPassword);
    } catch (error) {
      throw handleServiceError(error);
    }
  }
}
