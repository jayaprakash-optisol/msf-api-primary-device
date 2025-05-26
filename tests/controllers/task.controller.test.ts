import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { TaskController } from '../../src/controllers/task.controller';
import { TaskService } from '../../src/services/task.service';
import { TaskStatus } from '../../src/types';
import { StatusCodes } from 'http-status-codes';
import * as utils from '../../src/utils';
import {
  mockTask,
  mockTaskInsert,
  mockTaskInsertWithoutStatus,
  mockUpdatedTask,
  mockTaskServiceResponse,
  mockTaskUpdateServiceResponse,
  mockTasksListServiceResponse,
  mockParcelItemsServiceResponse,
  mockTaskNotFoundServiceResponse,
  mockTaskCreationFailedServiceResponse,
  mockInvalidStatusServiceResponse,
  mockCreateTaskRequest,
  mockUpdateTaskStatusRequest,
  mockGetAllTasksRequest,
  mockGetParcelItemsRequest,
  mockTaskQueryParams,
  mockPaginationParams,
  allTaskStatusValues,
  invalidStatusValues,
} from '../mocks';

// Mock the TaskService
vi.mock('../../src/services/task.service');

// Mock the asyncHandler middleware
vi.mock('../../src/middleware/async.middleware', () => ({
  asyncHandler: vi.fn(fn => {
    return async (req, res, next) => {
      try {
        await fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }),
}));

describe('TaskController', () => {
  let taskController: TaskController;
  let mockTaskService: any;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: any;
  let sendSuccessSpy: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock service instance
    mockTaskService = {
      createTask: vi.fn(),
      updateTaskStatus: vi.fn(),
      getAllTasks: vi.fn(),
      getTasksByParcelId: vi.fn(),
    };

    // Mock TaskService.getInstance to return our mock
    vi.mocked(TaskService.getInstance).mockReturnValue(mockTaskService);

    // Create controller instance
    taskController = new TaskController();

    // Create mock request and response objects
    mockRequest = {
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Create mock next function
    mockNext = vi.fn();

    // Spy on sendSuccess utility
    sendSuccessSpy = vi.spyOn(utils, 'sendSuccess');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTaskServiceResponse);
      mockRequest.body = mockTaskInsert;

      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(mockTaskInsert);
      expect(sendSuccessSpy).toHaveBeenCalledWith(
        mockResponse,
        mockTask,
        'Task created successfully',
        StatusCodes.CREATED,
      );
    });

    it('should create a task without status (default behavior)', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTaskServiceResponse);
      mockRequest.body = mockTaskInsertWithoutStatus;

      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(mockTaskInsertWithoutStatus);
      expect(sendSuccessSpy).toHaveBeenCalledWith(
        mockResponse,
        mockTask,
        'Task created successfully',
        StatusCodes.CREATED,
      );
    });

    it('should handle task creation failure', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTaskCreationFailedServiceResponse);
      mockRequest.body = mockTaskInsert;

      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(mockTaskInsert);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle task creation failure with null message', async () => {
      const failureResponseWithNullMessage = {
        success: false,
        message: null,
        data: null,
        statusCode: 400,
      };
      mockTaskService.createTask.mockResolvedValue(failureResponseWithNullMessage);
      mockRequest.body = mockTaskInsert;

      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(mockTaskInsert);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle service errors during task creation', async () => {
      mockTaskService.createTask.mockRejectedValue(new Error('Database connection failed'));
      mockRequest.body = mockTaskInsert;

      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(mockTaskInsert);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle empty request body', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTaskServiceResponse);
      mockRequest.body = {};

      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.createTask).toHaveBeenCalledWith({});
      expect(sendSuccessSpy).toHaveBeenCalled();
    });

    it('should handle task creation with all valid status values', async () => {
      for (const status of allTaskStatusValues) {
        mockTaskService.createTask.mockResolvedValue(mockTaskServiceResponse);
        mockRequest.body = { ...mockTaskInsert, status };

        await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

        expect(mockTaskService.createTask).toHaveBeenCalledWith({ ...mockTaskInsert, status });
      }
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      mockTaskService.updateTaskStatus.mockResolvedValue(mockTaskUpdateServiceResponse);
      mockRequest.params = { id: 'mock-task-id' };
      mockRequest.body = { status: TaskStatus.IN_PROGRESS };

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.updateTaskStatus).toHaveBeenCalledWith(
        'mock-task-id',
        TaskStatus.IN_PROGRESS,
      );
      expect(sendSuccessSpy).toHaveBeenCalledWith(
        mockResponse,
        mockUpdatedTask,
        'Task status updated successfully',
      );
    });

    it('should update task status to all valid enum values', async () => {
      for (const status of allTaskStatusValues) {
        mockTaskService.updateTaskStatus.mockResolvedValue({
          ...mockTaskUpdateServiceResponse,
          data: { ...mockUpdatedTask, status },
        });
        mockRequest.params = { id: 'mock-task-id' };
        mockRequest.body = { status };

        await taskController.updateTaskStatus(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(mockTaskService.updateTaskStatus).toHaveBeenCalledWith('mock-task-id', status);
      }
    });

    it('should handle invalid status values', async () => {
      for (const invalidStatus of invalidStatusValues) {
        vi.clearAllMocks(); // Clear mocks between iterations
        mockRequest.params = { id: 'mock-task-id' };
        mockRequest.body = { status: invalidStatus };

        await taskController.updateTaskStatus(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
        expect(mockTaskService.updateTaskStatus).not.toHaveBeenCalled();
      }
    });

    it('should handle task not found', async () => {
      mockTaskService.updateTaskStatus.mockResolvedValue(mockTaskNotFoundServiceResponse);
      mockRequest.params = { id: 'non-existent-id' };
      mockRequest.body = { status: TaskStatus.IN_PROGRESS };

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.updateTaskStatus).toHaveBeenCalledWith(
        'non-existent-id',
        TaskStatus.IN_PROGRESS,
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle task not found with null message', async () => {
      const notFoundResponseWithNullMessage = {
        success: false,
        message: null,
        data: null,
        statusCode: 404,
      };
      mockTaskService.updateTaskStatus.mockResolvedValue(notFoundResponseWithNullMessage);
      mockRequest.params = { id: 'non-existent-id' };
      mockRequest.body = { status: TaskStatus.IN_PROGRESS };

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.updateTaskStatus).toHaveBeenCalledWith(
        'non-existent-id',
        TaskStatus.IN_PROGRESS,
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle service errors during status update', async () => {
      mockTaskService.updateTaskStatus.mockRejectedValue(new Error('Database connection failed'));
      mockRequest.params = { id: 'mock-task-id' };
      mockRequest.body = { status: TaskStatus.IN_PROGRESS };

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.updateTaskStatus).toHaveBeenCalledWith(
        'mock-task-id',
        TaskStatus.IN_PROGRESS,
      );
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle missing task ID in params', async () => {
      mockRequest.params = {};
      mockRequest.body = { status: TaskStatus.IN_PROGRESS };

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.updateTaskStatus).toHaveBeenCalledWith(
        undefined,
        TaskStatus.IN_PROGRESS,
      );
    });

    it('should handle missing status in request body', async () => {
      mockRequest.params = { id: 'mock-task-id' };
      mockRequest.body = {};

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTaskService.updateTaskStatus).not.toHaveBeenCalled();
    });

    it('should handle special characters in task ID', async () => {
      const specialTaskId = 'task-with-special-chars-123!@#';
      mockTaskService.updateTaskStatus.mockResolvedValue(mockTaskUpdateServiceResponse);
      mockRequest.params = { id: specialTaskId };
      mockRequest.body = { status: TaskStatus.IN_PROGRESS };

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.updateTaskStatus).toHaveBeenCalledWith(
        specialTaskId,
        TaskStatus.IN_PROGRESS,
      );
    });
  });

  describe('getAllTasks', () => {
    it('should get all tasks successfully', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = {};

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        status: undefined,
        itemType: undefined,
        search: undefined,
        parcelId: undefined,
      });
      expect(sendSuccessSpy).toHaveBeenCalledWith(
        mockResponse,
        mockTasksListServiceResponse.data,
        'Tasks retrieved successfully',
      );
    });

    it('should handle query parameters correctly', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = {
        page: '2',
        limit: '5',
        status: TaskStatus.IN_PROGRESS,
        itemType: 'Medical Supplies',
        search: 'medical',
        parcelId: 'mock-parcel-id',
      };

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith({
        page: 2,
        limit: 5,
        status: TaskStatus.IN_PROGRESS,
        itemType: 'Medical Supplies',
        search: 'medical',
        parcelId: 'mock-parcel-id',
      });
    });

    it('should handle invalid pagination parameters', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = {
        page: 'invalid',
        limit: 'invalid',
      };

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith({
        page: NaN,
        limit: NaN,
        status: undefined,
        itemType: undefined,
        search: undefined,
        parcelId: undefined,
      });
    });

    it('should handle service failure during task retrieval', async () => {
      const failureResponse = {
        success: false,
        message: 'Failed to retrieve tasks',
        data: null,
        statusCode: 400,
      };
      mockTaskService.getAllTasks.mockResolvedValue(failureResponse);
      mockRequest.query = {};

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle service failure during task retrieval with null message', async () => {
      const failureResponseWithNullMessage = {
        success: false,
        message: null,
        data: null,
        statusCode: 400,
      };
      mockTaskService.getAllTasks.mockResolvedValue(failureResponseWithNullMessage);
      mockRequest.query = {};

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle service errors during task retrieval', async () => {
      mockTaskService.getAllTasks.mockRejectedValue(new Error('Database connection failed'));
      mockRequest.query = {};

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle filtering by all valid status values', async () => {
      for (const status of allTaskStatusValues) {
        mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
        mockRequest.query = { status };

        await taskController.getAllTasks(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(mockTaskService.getAllTasks).toHaveBeenCalledWith(
          expect.objectContaining({ status }),
        );
      }
    });

    it('should handle search functionality', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = { search: 'medical supplies' };

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'medical supplies' }),
      );
    });

    it('should handle empty query parameters', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = {
        page: '',
        limit: '',
        status: '',
        itemType: '',
        search: '',
        parcelId: '',
      };

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
        status: '',
        itemType: '',
        search: '',
        parcelId: '',
      });
    });
  });

  describe('getParcelItems', () => {
    it('should get parcel items successfully', async () => {
      mockTaskService.getTasksByParcelId.mockResolvedValue(mockParcelItemsServiceResponse);
      mockRequest.params = { parcelId: 'mock-parcel-id' };
      mockRequest.query = {};

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalledWith('mock-parcel-id', {
        page: undefined,
        limit: undefined,
      });
      expect(sendSuccessSpy).toHaveBeenCalledWith(
        mockResponse,
        mockParcelItemsServiceResponse.data,
        'Parcel items retrieved successfully',
      );
    });

    it('should handle pagination parameters for parcel items', async () => {
      mockTaskService.getTasksByParcelId.mockResolvedValue(mockParcelItemsServiceResponse);
      mockRequest.params = { parcelId: 'mock-parcel-id' };
      mockRequest.query = { page: '2', limit: '5' };

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalledWith('mock-parcel-id', {
        page: 2,
        limit: 5,
      });
    });

    it('should handle invalid pagination parameters for parcel items', async () => {
      mockTaskService.getTasksByParcelId.mockResolvedValue(mockParcelItemsServiceResponse);
      mockRequest.params = { parcelId: 'mock-parcel-id' };
      mockRequest.query = { page: 'invalid', limit: 'invalid' };

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalledWith('mock-parcel-id', {
        page: NaN,
        limit: NaN,
      });
    });

    it('should handle missing parcel ID', async () => {
      mockTaskService.getTasksByParcelId.mockResolvedValue(mockParcelItemsServiceResponse);
      mockRequest.params = {};
      mockRequest.query = {};

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalledWith(undefined, {
        page: undefined,
        limit: undefined,
      });
    });

    it('should handle service failure during parcel items retrieval', async () => {
      const failureResponse = {
        success: false,
        message: 'Failed to retrieve parcel items',
        data: null,
        statusCode: 400,
      };
      mockTaskService.getTasksByParcelId.mockResolvedValue(failureResponse);
      mockRequest.params = { parcelId: 'mock-parcel-id' };
      mockRequest.query = {};

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle service failure during parcel items retrieval with null message', async () => {
      const failureResponseWithNullMessage = {
        success: false,
        message: null,
        data: null,
        statusCode: 400,
      };
      mockTaskService.getTasksByParcelId.mockResolvedValue(failureResponseWithNullMessage);
      mockRequest.params = { parcelId: 'mock-parcel-id' };
      mockRequest.query = {};

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle service errors during parcel items retrieval', async () => {
      mockTaskService.getTasksByParcelId.mockRejectedValue(new Error('Database connection failed'));
      mockRequest.params = { parcelId: 'mock-parcel-id' };
      mockRequest.query = {};

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle special characters in parcel ID', async () => {
      const specialParcelId = 'parcel-with-special-chars-123!@#';
      mockTaskService.getTasksByParcelId.mockResolvedValue(mockParcelItemsServiceResponse);
      mockRequest.params = { parcelId: specialParcelId };
      mockRequest.query = {};

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalledWith(specialParcelId, {
        page: undefined,
        limit: undefined,
      });
    });

    it('should handle empty pagination query parameters', async () => {
      mockTaskService.getTasksByParcelId.mockResolvedValue(mockParcelItemsServiceResponse);
      mockRequest.params = { parcelId: 'mock-parcel-id' };
      mockRequest.query = { page: '', limit: '' };

      await taskController.getParcelItems(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockTaskService.getTasksByParcelId).toHaveBeenCalledWith('mock-parcel-id', {
        page: undefined,
        limit: undefined,
      });
    });
  });

  describe('Constructor and Service Integration', () => {
    it('should initialize with TaskService instance', () => {
      const controller = new TaskController();
      expect(TaskService.getInstance).toHaveBeenCalled();
      expect(controller).toBeInstanceOf(TaskController);
    });

    it('should use the same TaskService instance across method calls', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTaskServiceResponse);
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);

      mockRequest.body = mockTaskInsert;
      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      mockRequest.query = {};
      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      // TaskService.getInstance should be called only once during controller instantiation
      expect(TaskService.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle null request body', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTaskServiceResponse);
      mockRequest.body = null;

      await taskController.createTask(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(null);
    });

    it('should handle undefined request params', async () => {
      mockTaskService.updateTaskStatus.mockResolvedValue(mockTaskUpdateServiceResponse);
      mockRequest.params = undefined;
      mockRequest.body = { status: TaskStatus.IN_PROGRESS };

      await taskController.updateTaskStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTaskService.updateTaskStatus).not.toHaveBeenCalled();
    });

    it('should handle undefined request query', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = undefined;

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockTaskService.getAllTasks).not.toHaveBeenCalled();
    });

    it('should handle very large pagination values', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = {
        page: '999999999',
        limit: '999999999',
      };

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith({
        page: 999999999,
        limit: 999999999,
        status: undefined,
        itemType: undefined,
        search: undefined,
        parcelId: undefined,
      });
    });

    it('should handle negative pagination values', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = {
        page: '-1',
        limit: '-5',
      };

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith({
        page: -1,
        limit: -5,
        status: undefined,
        itemType: undefined,
        search: undefined,
        parcelId: undefined,
      });
    });

    it('should handle zero pagination values', async () => {
      mockTaskService.getAllTasks.mockResolvedValue(mockTasksListServiceResponse);
      mockRequest.query = {
        page: '0',
        limit: '0',
      };

      await taskController.getAllTasks(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockTaskService.getAllTasks).toHaveBeenCalledWith({
        page: 0,
        limit: 0,
        status: undefined,
        itemType: undefined,
        search: undefined,
        parcelId: undefined,
      });
    });
  });
});
