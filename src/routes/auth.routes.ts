import { Router } from 'express';

import { AuthController } from '../controllers/auth.controller';
import { validateGuestLogin } from '../validators';
import { authenticate, rateLimiter } from '../middleware';

const router = Router();
const authController = new AuthController();

router.post('/login', rateLimiter(), validateGuestLogin, authController.login);
router.post('/logout', authenticate, authController.logout);

export default router;
