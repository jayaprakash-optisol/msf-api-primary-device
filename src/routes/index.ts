import { Router } from 'express';

import authRoutes from './auth.routes';
import fileUploadRoutes from './fileUpload.routes';

const router = Router();

// Register all route modules
router.use('/auth', authRoutes);
router.use('/files', fileUploadRoutes);

export default router;
