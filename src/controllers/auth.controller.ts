import { type Request, type Response } from 'express';
import { asyncHandler } from '../middleware';
import { AuthService } from '../services';
import { AuthRequest, type IAuthService } from '../types';
import { authResponse, BadRequestError, sendSuccess, UnauthorizedError } from '../utils';

export class AuthController {
  private readonly authService: IAuthService;

  constructor() {
    this.authService = AuthService.getInstance();
  }

  /**
   * Login user
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    const result = await this.authService.login(username, password);

    if (!result.success) {
      throw new UnauthorizedError(result.error ?? authResponse.errors.loginFailed);
    }

    sendSuccess(res, result.data, authResponse.success.loggedIn);
  });

  /**
   * Logout user
   */
  logout = asyncHandler(async (req: AuthRequest, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const result = await this.authService.logout(token);

    if (!result.success) {
      throw new BadRequestError(result.error ?? authResponse.errors.logoutFailed);
    }

    sendSuccess(res, result.data, result.message);
  });
}
