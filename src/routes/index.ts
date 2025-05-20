import { Router } from 'express';

import authRoutes from './auth.routes';

const router = Router();

// Register all route modules
router.use('/guest/auth', authRoutes);

export default router;
