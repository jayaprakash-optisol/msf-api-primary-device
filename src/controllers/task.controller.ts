import { type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/async.middleware';
import { TaskService } from '../services/task.service';
import { type ITaskService, type TaskQueryParams, TaskStatus } from '../types';
import { sendSuccess, taskResponse, NotFoundError, BadRequestError } from '../utils';

export class TaskController {
  private readonly taskService: ITaskService;

  constructor() {
    this.taskService = TaskService.getInstance();
  }

  /**
   * Create a new task
   */
  createTask = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await this.taskService.createTask(req.body);

    if (!result.success) {
      throw new BadRequestError(result.message ?? taskResponse.errors.creationFailed);
    }

    sendSuccess(res, result.data, result.message, result.statusCode);
  });

  /**
   * Update task status
   */
  updateTaskStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!Object.values(TaskStatus).includes(status)) {
      throw new BadRequestError(taskResponse.errors.invalidStatus);
    }

    const result = await this.taskService.updateTaskStatus(id, status);

    if (!result.success) {
      throw new NotFoundError(result.message ?? taskResponse.errors.notFound);
    }

    sendSuccess(res, result.data, result.message);
  });

  /**
   * Get all tasks with pagination and filtering
   */
  getAllTasks = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const queryParams: TaskQueryParams = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      status: req.query.status as TaskStatus,
      itemType: req.query.itemType as string,
      search: req.query.search as string,
      parcelId: req.query.parcelId as string,
    };

    const result = await this.taskService.getAllTasks(queryParams);

    if (!result.success) {
      throw new BadRequestError(result.message ?? taskResponse.errors.retrievalFailed);
    }

    sendSuccess(res, result.data, result.message);
  });

  /**
   * Get parcel items by parcel ID with pagination
   */
  getParcelItems = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { parcelId } = req.params;
    const paginationParams = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };

    const result = await this.taskService.getTasksByParcelId(parcelId, paginationParams);

    if (!result.success) {
      throw new BadRequestError(result.message ?? taskResponse.errors.parcelItemsRetrievalFailed);
    }

    sendSuccess(res, result.data, result.message);
  });
}
