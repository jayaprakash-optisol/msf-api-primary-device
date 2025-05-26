import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';
import { authenticate } from '../middleware';

const router = Router();
const taskController = new TaskController();

// Task routes
router.post('/', authenticate, taskController.createTask);
router.patch('/:id/status', authenticate, taskController.updateTaskStatus);
router.get('/', authenticate, taskController.getAllTasks);
router.get('/parcel/:parcelId/items', authenticate, taskController.getParcelItems);

export default router;
