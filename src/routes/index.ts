import { Router } from 'express';

import authRoutes from './auth.routes';
import fileUploadRoutes from './fileUpload.routes';
import taskRoutes from './task.routes';

const router = Router();

// Register all route modules
router.use('/auth', authRoutes);
router.use('/files', fileUploadRoutes);
router.use('/tasks', taskRoutes);

export default router;
