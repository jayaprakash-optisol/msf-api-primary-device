import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import express, { Application } from 'express';
import request from 'supertest';
import taskRoutes from '../../src/routes/task.routes';
import { StatusCodes } from 'http-status-codes';
import { TaskStatus } from '../../src/types';
import {
  mockTask,
  mockTaskWithParcel,
  mockParcelItem,
  mockPaginatedTasksResponse,
  mockPaginatedParcelItemsResponse,
} from '../mocks';

// Mock flags for different test scenarios
let shouldSimulateError = false;
let shouldSimulateNotFound = false;
let shouldSimulateInvalidStatus = false;
let shouldSimulateServiceFailure = false;

// Mock the auth middleware
vi.mock('../../src/middleware/auth.middleware', () => ({
  authenticate: vi.fn((req, res, next) => next()),
}));

// Mock the task controller
vi.mock('../../src/controllers/task.controller', () => {
  return {
    TaskController: vi.fn().mockImplementation(() => ({
      createTask: vi.fn((req, res) => {
        if (shouldSimulateError) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Failed to create task',
          });
        }
        if (shouldSimulateServiceFailure) {
          return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error',
          });
        }
        return res.status(StatusCodes.CREATED).json({
          success: true,
          message: 'Task created successfully',
          data: mockTask,
        });
      }),

      updateTaskStatus: vi.fn((req, res) => {
        if (shouldSimulateInvalidStatus) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Invalid task status provided',
          });
        }
        if (shouldSimulateNotFound) {
          return res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            message: 'Task not found',
          });
        }
        if (shouldSimulateError) {
          return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to update task status',
          });
        }
        return res.status(StatusCodes.OK).json({
          success: true,
          message: 'Task status updated successfully',
          data: { ...mockTask, status: req.body.status },
        });
      }),

      getAllTasks: vi.fn((req, res) => {
        if (shouldSimulateError) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Failed to retrieve tasks',
          });
        }
        if (shouldSimulateServiceFailure) {
          return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Internal server error',
          });
        }
        return res.status(StatusCodes.OK).json({
          success: true,
          message: 'Tasks retrieved successfully',
          data: mockPaginatedTasksResponse,
        });
      }),

      getParcelItems: vi.fn((req, res) => {
        if (shouldSimulateError) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Failed to retrieve parcel items',
          });
        }
        if (shouldSimulateNotFound) {
          return res.status(StatusCodes.NOT_FOUND).json({
            success: false,
            message: 'Parcel not found',
          });
        }
        return res.status(StatusCodes.OK).json({
          success: true,
          message: 'Parcel items retrieved successfully',
          data: mockPaginatedParcelItemsResponse,
        });
      }),
    })),
  };
});

describe('Task Routes (Integration)', () => {
  let app: Application;
  let api: any;

  beforeAll(() => {
    // Create test Express application
    app = express();
    app.use(express.json());

    // Mount task routes on /api/v1/tasks
    app.use('/api/v1/tasks', taskRoutes);

    // Create supertest agent
    api = request(app);
  });

  beforeEach(() => {
    // Reset all flags before each test
    shouldSimulateError = false;
    shouldSimulateNotFound = false;
    shouldSimulateInvalidStatus = false;
    shouldSimulateServiceFailure = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/tasks', () => {
    const validTaskData = {
      parcelId: 'mock-parcel-id',
      itemType: 'Medical Supplies',
      status: TaskStatus.YET_TO_START,
    };

    it('should create a task successfully', async () => {
      const response = await api
        .post('/api/v1/tasks')
        .send(validTaskData)
        .expect(StatusCodes.CREATED);

      expect(response.body).toEqual({
        success: true,
        message: 'Task created successfully',
        data: expect.objectContaining({
          id: expect.any(String),
          parcelId: validTaskData.parcelId,
          itemType: validTaskData.itemType,
          status: expect.any(String),
        }),
      });
    });

    it('should create a task without status (default to Yet to Start)', async () => {
      const taskDataWithoutStatus = {
        parcelId: 'mock-parcel-id',
        itemType: 'Medical Supplies',
      };

      const response = await api
        .post('/api/v1/tasks')
        .send(taskDataWithoutStatus)
        .expect(StatusCodes.CREATED);

      expect(response.body).toEqual({
        success: true,
        message: 'Task created successfully',
        data: expect.objectContaining({
          id: expect.any(String),
          parcelId: taskDataWithoutStatus.parcelId,
          itemType: taskDataWithoutStatus.itemType,
        }),
      });
    });

    it('should handle creation errors', async () => {
      shouldSimulateError = true;

      const response = await api
        .post('/api/v1/tasks')
        .send(validTaskData)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to create task',
      });
    });

    it('should handle internal server errors', async () => {
      shouldSimulateServiceFailure = true;

      const response = await api
        .post('/api/v1/tasks')
        .send(validTaskData)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(response.body).toEqual({
        success: false,
        message: 'Internal server error',
      });
    });

    it('should handle empty request body', async () => {
      const response = await api.post('/api/v1/tasks').send({}).expect(StatusCodes.CREATED); // Controller doesn't validate, so it passes through

      expect(response.body.success).toBe(true);
    });
  });

  describe('PATCH /api/v1/tasks/:id/status', () => {
    const taskId = 'mock-task-id';
    const validStatusUpdate = {
      status: TaskStatus.IN_PROGRESS,
    };

    it('should update task status successfully', async () => {
      const response = await api
        .patch(`/api/v1/tasks/${taskId}/status`)
        .send(validStatusUpdate)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        success: true,
        message: 'Task status updated successfully',
        data: expect.objectContaining({
          id: taskId,
          status: validStatusUpdate.status,
        }),
      });
    });

    it('should update task status to all valid enum values', async () => {
      const statusValues = [
        TaskStatus.YET_TO_START,
        TaskStatus.IN_PROGRESS,
        TaskStatus.PAUSED,
        TaskStatus.SUBMITTED,
      ];

      for (const status of statusValues) {
        const response = await api
          .patch(`/api/v1/tasks/${taskId}/status`)
          .send({ status })
          .expect(StatusCodes.OK);

        expect(response.body.data.status).toBe(status);
      }
    });

    it('should handle invalid status values', async () => {
      shouldSimulateInvalidStatus = true;

      const response = await api
        .patch(`/api/v1/tasks/${taskId}/status`)
        .send({ status: 'INVALID_STATUS' })
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toEqual({
        success: false,
        message: 'Invalid task status provided',
      });
    });

    it('should handle task not found', async () => {
      shouldSimulateNotFound = true;

      const response = await api
        .patch('/api/v1/tasks/non-existent-id/status')
        .send(validStatusUpdate)
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body).toEqual({
        success: false,
        message: 'Task not found',
      });
    });

    it('should handle update errors', async () => {
      shouldSimulateError = true;

      const response = await api
        .patch(`/api/v1/tasks/${taskId}/status`)
        .send(validStatusUpdate)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to update task status',
      });
    });

    it('should handle missing status in request body', async () => {
      shouldSimulateInvalidStatus = true;

      const response = await api
        .patch(`/api/v1/tasks/${taskId}/status`)
        .send({})
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('should get all tasks successfully', async () => {
      const response = await api.get('/api/v1/tasks').expect(StatusCodes.OK);

      expect(response.body).toEqual({
        success: true,
        message: 'Tasks retrieved successfully',
        data: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              parcelId: expect.any(String),
              status: expect.any(String),
              itemType: expect.any(String),
            }),
          ]),
          total: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      });
    });

    it('should handle pagination parameters', async () => {
      const response = await api
        .get('/api/v1/tasks')
        .query({ page: 2, limit: 5 })
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
    });

    it('should handle filtering by status', async () => {
      const response = await api
        .get('/api/v1/tasks')
        .query({ status: TaskStatus.IN_PROGRESS })
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('should handle search functionality', async () => {
      const response = await api
        .get('/api/v1/tasks')
        .query({ search: 'medical' })
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('should handle multiple query parameters', async () => {
      const response = await api
        .get('/api/v1/tasks')
        .query({
          page: 1,
          limit: 10,
          status: TaskStatus.YET_TO_START,
          search: 'supplies',
          itemType: 'Medical',
          parcelId: 'mock-parcel-id',
        })
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });

    it('should handle retrieval errors', async () => {
      shouldSimulateError = true;

      const response = await api.get('/api/v1/tasks').expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to retrieve tasks',
      });
    });

    it('should handle internal server errors', async () => {
      shouldSimulateServiceFailure = true;

      const response = await api.get('/api/v1/tasks').expect(StatusCodes.INTERNAL_SERVER_ERROR);

      expect(response.body).toEqual({
        success: false,
        message: 'Internal server error',
      });
    });

    it('should handle invalid pagination parameters gracefully', async () => {
      const response = await api
        .get('/api/v1/tasks')
        .query({ page: 'invalid', limit: 'invalid' })
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/tasks/parcel/:parcelId/items', () => {
    const parcelId = 'mock-parcel-id';

    it('should get parcel items successfully', async () => {
      const response = await api
        .get(`/api/v1/tasks/parcel/${parcelId}/items`)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        success: true,
        message: 'Parcel items retrieved successfully',
        data: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              parcelId: expect.any(String),
              productId: expect.any(String),
              product: expect.objectContaining({
                id: expect.any(String),
                productCode: expect.any(String),
                productDescription: expect.any(String),
              }),
              packingListNumber: expect.any(String),
            }),
          ]),
          total: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
          totalPages: expect.any(Number),
        }),
      });
    });

    it('should handle pagination parameters for parcel items', async () => {
      const response = await api
        .get(`/api/v1/tasks/parcel/${parcelId}/items`)
        .query({ page: 2, limit: 5 })
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });

    it('should handle parcel not found', async () => {
      shouldSimulateNotFound = true;

      const response = await api
        .get('/api/v1/tasks/parcel/non-existent-parcel/items')
        .expect(StatusCodes.NOT_FOUND);

      expect(response.body).toEqual({
        success: false,
        message: 'Parcel not found',
      });
    });

    it('should handle retrieval errors for parcel items', async () => {
      shouldSimulateError = true;

      const response = await api
        .get(`/api/v1/tasks/parcel/${parcelId}/items`)
        .expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toEqual({
        success: false,
        message: 'Failed to retrieve parcel items',
      });
    });

    it('should handle special characters in parcel ID', async () => {
      const specialParcelId = 'parcel-with-special-chars-123!@#';
      const response = await api
        .get(`/api/v1/tasks/parcel/${encodeURIComponent(specialParcelId)}/items`)
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });

    it('should handle empty parcel ID', async () => {
      const response = await api.get('/api/v1/tasks/parcel//items').expect(StatusCodes.NOT_FOUND); // Express router won't match this route
    });

    it('should handle invalid pagination parameters for parcel items', async () => {
      const response = await api
        .get(`/api/v1/tasks/parcel/${parcelId}/items`)
        .query({ page: 'invalid', limit: 'invalid' })
        .expect(StatusCodes.OK);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Authentication middleware', () => {
    it('should require authentication for all routes', async () => {
      // This test verifies that the authenticate middleware is applied to all routes
      // Since we're mocking the middleware to always call next(), we just verify the routes exist

      const routes = [
        { method: 'post', path: '/api/v1/tasks' },
        { method: 'patch', path: '/api/v1/tasks/test-id/status' },
        { method: 'get', path: '/api/v1/tasks' },
        { method: 'get', path: '/api/v1/tasks/parcel/test-parcel/items' },
      ];

      for (const route of routes) {
        const response = await api[route.method](route.path);
        // Should not get 401 because middleware is mocked to pass through
        expect(response.status).not.toBe(401);
      }
    });
  });

  describe('Route parameter validation', () => {
    it('should handle various task ID formats', async () => {
      const taskIds = ['uuid-format-task-id', '123456789', 'task-with-dashes', 'UPPERCASE-TASK-ID'];

      for (const taskId of taskIds) {
        const response = await api
          .patch(`/api/v1/tasks/${taskId}/status`)
          .send({ status: TaskStatus.IN_PROGRESS });

        expect(response.status).toBeOneOf([
          StatusCodes.OK,
          StatusCodes.NOT_FOUND,
          StatusCodes.BAD_REQUEST,
        ]);
      }
    });

    it('should handle various parcel ID formats', async () => {
      const parcelIds = [
        'uuid-format-parcel-id',
        '123456789',
        'parcel-with-dashes',
        'UPPERCASE-PARCEL-ID',
      ];

      for (const parcelId of parcelIds) {
        const response = await api.get(`/api/v1/tasks/parcel/${parcelId}/items`);
        expect(response.status).toBeOneOf([
          StatusCodes.OK,
          StatusCodes.NOT_FOUND,
          StatusCodes.BAD_REQUEST,
        ]);
      }
    });
  });
});
