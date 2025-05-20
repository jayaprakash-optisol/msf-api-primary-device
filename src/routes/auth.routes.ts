import { Router } from 'express';

import { AuthController } from '../controllers/auth.controller';
import { validateGuestLogin } from '../validators';

const router = Router();
const authController = new AuthController();

router.post('/login', validateGuestLogin, authController.login);

export default router;
