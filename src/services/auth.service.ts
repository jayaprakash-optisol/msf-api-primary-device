import {
  Guest,
  type IAuthService,
  IGuestService,
  type JwtPayload,
  type ServiceResponse,
} from '../types';
import { _ok, authResponse, handleServiceError, jwtUtil, UnauthorizedError } from '../utils';

import { GuestService } from './guest.service';

export class AuthService implements IAuthService {
  private readonly guestService: IGuestService;
  private static instance: AuthService;

  private constructor() {
    this.guestService = GuestService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Login user
   * @param username - The username of the user to login
   * @param password - The password of the user to login
   * @returns A service response containing the user and the generated token
   */
  async login(
    username: string,
    password: string,
  ): Promise<ServiceResponse<{ user: Omit<Guest, 'password'>; token: string }>> {
    try {
      // Verify password
      const verifyResult = await this.guestService.verifyGuestCredentials(username, password);

      if (!verifyResult.success || !verifyResult.data) {
        throw new UnauthorizedError(verifyResult.error ?? authResponse.errors.invalidCredentials);
      }

      // Generate JWT token
      const payload: JwtPayload = {
        guestId: verifyResult.data.id,
        username: verifyResult.data.username,
        role: verifyResult.data.role,
      };

      const token = jwtUtil.generateToken(payload);

      return _ok(
        {
          user: verifyResult.data,
          token,
        },
        authResponse.success.loggedIn,
      );
    } catch (error) {
      throw handleServiceError(error, authResponse.errors.loginFailed);
    }
  }

  /**
   * Logout user by invalidating their session
   * @param token The JWT token to invalidate
   */
  async logout(token: string): Promise<ServiceResponse<null>> {
    try {
      await jwtUtil.revokeToken(token);
      return _ok(null, 'Logged out successfully');
    } catch (error) {
      throw handleServiceError(error, authResponse.errors.logoutFailed);
    }
  }
}
