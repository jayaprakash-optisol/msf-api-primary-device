import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskService } from '../../src/services/task.service';
import { db } from '../../src/config/database.config';
import { tasks } from '../../src/models';
import { TaskStatus } from '../../src/types';
import { StatusCodes } from 'http-status-codes';
import { sql } from 'drizzle-orm';
import * as utils from '../../src/utils';

// Mock the utilities
vi.mock('../../src/utils', async () => {
  const actual = await vi.importActual('../../src/utils');
  return {
    ...actual,
    buildPaginationAndFilters: vi.fn(),
    buildWhereClause: vi.fn(),
  };
});

// Mock data for testing
const mockTaskData = {
  parcelId: 'mock-parcel-id',
  status: TaskStatus.YET_TO_START,
  itemType: 'Medical Supplies',
};

const mockTask = {
  id: 'mock-task-id',
  parcelId: 'mock-parcel-id',
  status: 'Yet to Start',
  itemType: 'Medical Supplies',
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
};

const mockParcel = {
  id: 'mock-parcel-id',
  purchaseOrderNumber: 'PO-2024-001',
  parcelFrom: 1001,
  parcelTo: 2001,
  totalWeight: '25.5',
  totalVolume: '12.3',
  totalNumberOfParcels: 1,
  packingListNumber: 'PL-2024-001',
  sourceSystem: 'FILE_UPLOAD',
  createdAt: new Date('2024-01-15T09:00:00Z'),
  updatedAt: new Date('2024-01-15T09:00:00Z'),
};

const mockTaskWithParcel = {
  ...mockTask,
  parcel: mockParcel,
};

const mockParcelItem = {
  id: 'mock-parcel-item-id',
  productId: 'mock-product-id',
  parcelId: 'mock-parcel-id',
  productQuantity: 100,
  productCode: 'MED-001',
  expiryDate: new Date('2025-12-31T00:00:00Z'),
  batchNumber: 'BATCH-2024-001',
  weight: '5.5',
  volume: '2.1',
  parcelNumber: 'PN-2024-001',
  lineNumber: 1,
  externalRef: 'EXT-REF-001',
  unitOfMeasure: 'PCE',
  currencyUnit: 'USD',
  unitPrice: '25.99',
  messageEsc1: 'Handle with care',
  messageEsc2: 'Temperature sensitive',
  comments: 'Medical supplies for emergency use',
  contains: 'Syringes and bandages',
  sourceSystem: 'FILE_UPLOAD',
  createdAt: new Date('2024-01-15T09:00:00Z'),
  updatedAt: new Date('2024-01-15T09:00:00Z'),
  product: {
    id: 'mock-product-id',
    unidataId: 'UNI-001',
    productCode: 'MED-001',
    productDescription: 'Medical Syringes 10ml',
    type: 'Medical Device',
    state: 'Active',
    freeCode: 'FC-001',
    standardizationLevel: 'Level 1',
    labels: { category: 'medical', priority: 'high' },
    sourceSystem: 'FILE_UPLOAD',
    createdAt: new Date('2024-01-15T08:00:00Z'),
    updatedAt: new Date('2024-01-15T08:00:00Z'),
  },
  packingListNumber: 'PL-2024-001',
};

describe('TaskService', () => {
  let taskService: TaskService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the singleton instance
    // @ts-ignore - Private property access for testing
    TaskService.instance = undefined;

    // Get the service instance
    taskService = TaskService.getInstance();

    // Setup default utility mocks
    vi.mocked(utils.buildPaginationAndFilters).mockReturnValue({
      offset: 0,
      limit: 10,
      page: 1,
      limitValue: 10,
      status: undefined,
      search: undefined,
      filters: {},
    });
    vi.mocked(utils.buildWhereClause).mockReturnValue(sql`1=1` as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = TaskService.getInstance();
      const instance2 = TaskService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should create a new instance if none exists', () => {
      // @ts-ignore - Private property access for testing
      TaskService.instance = undefined;
      const instance = TaskService.getInstance();
      expect(instance).toBeInstanceOf(TaskService);
    });
  });

  describe('createTask', () => {
    it('should create a task successfully with provided data', async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTask]),
      };
      vi.spyOn(db, 'insert').mockReturnValue(mockInsert as any);

      const result = await taskService.createTask(mockTaskData);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(StatusCodes.CREATED);
      expect(result.data).toEqual(mockTask);
      expect(db.insert).toHaveBeenCalledWith(tasks);
      expect(mockInsert.values).toHaveBeenCalledWith({
        ...mockTaskData,
        status: TaskStatus.YET_TO_START,
      });
    });

    it('should create a task with default status when status is not provided', async () => {
      const taskDataWithoutStatus = {
        parcelId: 'mock-parcel-id',
        itemType: 'Medical Supplies',
      };

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTask]),
      };
      vi.spyOn(db, 'insert').mockReturnValue(mockInsert as any);

      const result = await taskService.createTask(taskDataWithoutStatus);

      expect(result.success).toBe(true);
      expect(mockInsert.values).toHaveBeenCalledWith({
        ...taskDataWithoutStatus,
        status: TaskStatus.YET_TO_START,
      });
    });

    it('should handle database errors correctly', async () => {
      vi.spyOn(db, 'insert').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(taskService.createTask(mockTaskData)).rejects.toThrow('Failed to create task');
    });

    it('should preserve provided status when creating task', async () => {
      const taskDataWithStatus = {
        ...mockTaskData,
        status: TaskStatus.IN_PROGRESS,
      };

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTask]),
      };
      vi.spyOn(db, 'insert').mockReturnValue(mockInsert as any);

      await taskService.createTask(taskDataWithStatus);

      expect(mockInsert.values).toHaveBeenCalledWith(taskDataWithStatus);
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status successfully', async () => {
      const updatedTask = { ...mockTask, status: 'In Progress', updatedAt: new Date() };
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedTask]),
      };
      vi.spyOn(db, 'update').mockReturnValue(mockUpdate as any);

      const result = await taskService.updateTaskStatus('mock-task-id', TaskStatus.IN_PROGRESS);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedTask);
      expect(db.update).toHaveBeenCalledWith(tasks);
      expect(mockUpdate.set).toHaveBeenCalledWith({
        status: TaskStatus.IN_PROGRESS,
        updatedAt: expect.any(Date),
      });
    });

    it('should throw NotFoundError when task does not exist', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      vi.spyOn(db, 'update').mockReturnValue(mockUpdate as any);

      await expect(
        taskService.updateTaskStatus('non-existent-id', TaskStatus.IN_PROGRESS),
      ).rejects.toThrow('Task not found');
    });

    it('should handle database errors correctly', async () => {
      vi.spyOn(db, 'update').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(
        taskService.updateTaskStatus('mock-task-id', TaskStatus.IN_PROGRESS),
      ).rejects.toThrow('Failed to update task status');
    });

    it('should update task with all valid status values', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTask]),
      };
      vi.spyOn(db, 'update').mockReturnValue(mockUpdate as any);

      const statusValues = [
        TaskStatus.YET_TO_START,
        TaskStatus.IN_PROGRESS,
        TaskStatus.PAUSED,
        TaskStatus.SUBMITTED,
      ];

      for (const status of statusValues) {
        await taskService.updateTaskStatus('mock-task-id', status);
        expect(mockUpdate.set).toHaveBeenCalledWith({
          status,
          updatedAt: expect.any(Date),
        });
      }
    });
  });

  describe('getAllTasks', () => {
    it('should get all tasks with pagination successfully', async () => {
      // Mock Promise.all to return count and data
      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockTaskWithParcel]]);

      const result = await taskService.getAllTasks({});

      expect(result.success).toBe(true);
      expect(result.data!).toEqual({
        items: expect.arrayContaining([
          expect.objectContaining({
            id: mockTask.id,
            status: mockTask.status,
            parcel: expect.objectContaining({
              id: mockParcel.id,
            }),
          }),
        ]),
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should handle pagination parameters correctly', async () => {
      vi.mocked(utils.buildPaginationAndFilters).mockReturnValue({
        offset: 5,
        limit: 5,
        page: 2,
        limitValue: 5,
        status: undefined,
        search: undefined,
        filters: {},
      });

      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockTaskWithParcel]]);

      const params = { page: 2, limit: 5 };
      await taskService.getAllTasks(params);

      expect(utils.buildPaginationAndFilters).toHaveBeenCalledWith(params);
    });

    it('should handle filtering by status', async () => {
      vi.mocked(utils.buildPaginationAndFilters).mockReturnValue({
        offset: 0,
        limit: 10,
        page: 1,
        limitValue: 10,
        status: TaskStatus.IN_PROGRESS,
        search: undefined,
        filters: { status: TaskStatus.IN_PROGRESS },
      });

      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockTaskWithParcel]]);

      const params = { status: TaskStatus.IN_PROGRESS };
      await taskService.getAllTasks(params);

      expect(utils.buildWhereClause).toHaveBeenCalledWith(
        { status: TaskStatus.IN_PROGRESS, search: undefined },
        expect.any(Object),
      );
    });

    it('should handle search functionality', async () => {
      vi.mocked(utils.buildPaginationAndFilters).mockReturnValue({
        offset: 0,
        limit: 10,
        page: 1,
        limitValue: 10,
        status: undefined,
        search: 'medical',
        filters: { search: 'medical' },
      });

      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockTaskWithParcel]]);

      const params = { search: 'medical' };
      await taskService.getAllTasks(params);

      expect(utils.buildWhereClause).toHaveBeenCalledWith(
        { status: undefined, search: 'medical' },
        expect.any(Object),
      );
    });

    it('should return empty results when no tasks found', async () => {
      vi.spyOn(Promise, 'all').mockResolvedValue([0, []]);

      const result = await taskService.getAllTasks({});

      expect(result.success).toBe(true);
      expect(result.data!.items).toEqual([]);
      expect(result.data!.total).toBe(0);
      expect(result.data!.totalPages).toBe(0);
    });

    it('should handle database errors correctly', async () => {
      vi.spyOn(Promise, 'all').mockRejectedValue(new Error('Database connection failed'));

      await expect(taskService.getAllTasks({})).rejects.toThrow('Failed to retrieve tasks');
    });

    it('should calculate total pages correctly', async () => {
      vi.spyOn(Promise, 'all').mockResolvedValue([25, [mockTaskWithParcel]]);

      const result = await taskService.getAllTasks({ limit: 10 });

      expect(result.data!.totalPages).toBe(3); // Math.ceil(25/10) = 3
    });
  });

  describe('getTasksByParcelId', () => {
    it('should get parcel items by parcel ID successfully', async () => {
      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockParcelItem]]);

      const result = await taskService.getTasksByParcelId('mock-parcel-id');

      expect(result.success).toBe(true);
      expect(result.data!).toEqual({
        items: [mockParcelItem],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should handle pagination parameters correctly', async () => {
      vi.mocked(utils.buildPaginationAndFilters).mockReturnValue({
        offset: 5,
        limit: 5,
        page: 2,
        limitValue: 5,
        status: undefined,
        search: undefined,
        filters: {},
      });

      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockParcelItem]]);

      const params = { page: 2, limit: 5 };
      await taskService.getTasksByParcelId('mock-parcel-id', params);

      expect(utils.buildPaginationAndFilters).toHaveBeenCalledWith(params);
    });

    it('should include product data and packing list number', async () => {
      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockParcelItem]]);

      const result = await taskService.getTasksByParcelId('mock-parcel-id');

      expect(result.data!.items[0]).toEqual(
        expect.objectContaining({
          product: expect.objectContaining({
            id: 'mock-product-id',
            productCode: 'MED-001',
            productDescription: 'Medical Syringes 10ml',
          }),
          packingListNumber: 'PL-2024-001',
        }),
      );
    });

    it('should return empty results when no parcel items found', async () => {
      vi.spyOn(Promise, 'all').mockResolvedValue([0, []]);

      const result = await taskService.getTasksByParcelId('non-existent-parcel-id');

      expect(result.success).toBe(true);
      expect(result.data!.items).toEqual([]);
      expect(result.data!.total).toBe(0);
    });

    it('should handle database errors correctly', async () => {
      vi.spyOn(Promise, 'all').mockRejectedValue(new Error('Database connection failed'));

      await expect(taskService.getTasksByParcelId('mock-parcel-id')).rejects.toThrow(
        'Failed to retrieve parcel items',
      );
    });

    it('should handle undefined pagination parameters', async () => {
      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockParcelItem]]);

      const result = await taskService.getTasksByParcelId('mock-parcel-id', undefined);

      expect(result.success).toBe(true);
      expect(result.data!.page).toBe(1);
      expect(result.data!.limit).toBe(10);
    });
  });

  describe('_getTotalCount (private method)', () => {
    it('should get total count correctly', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: '5' }]), // String to test Number() conversion
      };
      vi.spyOn(db, 'select').mockReturnValue(mockSelect as any);

      // @ts-ignore - Accessing private method for testing
      const result = await taskService._getTotalCount(tasks);

      expect(result).toBe(5);
      expect(typeof result).toBe('number');
      expect(db.select).toHaveBeenCalled();
      expect(mockSelect.from).toHaveBeenCalledWith(tasks);
    });

    it('should handle where clause correctly', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: '10' }]),
      };
      vi.spyOn(db, 'select').mockReturnValue(mockSelect as any);

      const whereClause = sql`status = 'In Progress'`;

      // @ts-ignore - Accessing private method for testing
      const result = await taskService._getTotalCount(tasks, whereClause);

      expect(result).toBe(10);
      expect(mockSelect.where).toHaveBeenCalledWith(whereClause);
    });

    it('should convert string count to number', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: '42' }]), // String value
      };
      vi.spyOn(db, 'select').mockReturnValue(mockSelect as any);

      // @ts-ignore - Accessing private method for testing
      const result = await taskService._getTotalCount(tasks);

      expect(result).toBe(42);
      expect(typeof result).toBe('number');
    });
  });

  describe('transformToTaskWithRelations (private method)', () => {
    it('should transform task data correctly', () => {
      const rawTaskData = [
        {
          id: 'task-1',
          parcelId: 'parcel-1',
          status: 'Yet to Start',
          itemType: 'Medical',
          createdAt: new Date(),
          updatedAt: new Date(),
          parcel: mockParcel,
        },
      ];

      // @ts-ignore - Accessing private method for testing
      const result = taskService.transformToTaskWithRelations(rawTaskData);

      expect(result).toEqual([
        expect.objectContaining({
          id: 'task-1',
          parcelId: 'parcel-1',
          status: 'Yet to Start',
          itemType: 'Medical',
          parcel: mockParcel,
        }),
      ]);
    });

    it('should handle null parcel data', () => {
      const rawTaskData = [
        {
          id: 'task-1',
          parcelId: null,
          status: 'Yet to Start',
          itemType: 'Medical',
          createdAt: new Date(),
          updatedAt: new Date(),
          parcel: null,
        },
      ];

      // @ts-ignore - Accessing private method for testing
      const result = taskService.transformToTaskWithRelations(rawTaskData);

      expect(result[0].parcel).toBeNull();
    });

    it('should handle empty array', () => {
      // @ts-ignore - Accessing private method for testing
      const result = taskService.transformToTaskWithRelations([]);

      expect(result).toEqual([]);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should handle SQL injection attempts safely', async () => {
      const maliciousInput = "'; DROP TABLE tasks; --";
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      vi.spyOn(db, 'update').mockReturnValue(mockUpdate as any);

      await expect(
        taskService.updateTaskStatus(maliciousInput, TaskStatus.IN_PROGRESS),
      ).rejects.toThrow('Task not found');
    });

    it('should handle very large pagination requests', async () => {
      vi.mocked(utils.buildPaginationAndFilters).mockReturnValue({
        offset: 999999000,
        limit: 1000000,
        page: 1000000,
        limitValue: 1000000,
        status: undefined,
        search: undefined,
        filters: {},
      });

      vi.spyOn(Promise, 'all').mockResolvedValue([1, [mockTaskWithParcel]]);

      const params = { page: 1000000, limit: 1000000 };
      const result = await taskService.getAllTasks(params);

      expect(result.success).toBe(true);
    });

    it('should handle concurrent requests gracefully', async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockTask]),
      };
      vi.spyOn(db, 'insert').mockReturnValue(mockInsert as any);

      const promises = Array(10)
        .fill(null)
        .map(() =>
          taskService.createTask({ ...mockTaskData, parcelId: `parcel-${Math.random()}` }),
        );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});
