import { type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/async.middleware';
import { AuthService } from '../services';
import { type IAuthService } from '../types';
import { sendSuccess, UnauthorizedError, authResponse } from '../utils';

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
}
