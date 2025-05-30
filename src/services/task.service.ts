import { eq, desc, sql } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { db } from '../config/database.config';
import { tasks, parcels, parcelItems, products } from '../models';
import {
  type ServiceResponse,
  type PaginatedResult,
  type PaginationParams,
  type Task,
  type TaskInsert,
  type TaskWithRelations,
  type TaskQueryParams,
  type ITaskService,
  ParcelItemWithProductData,
  TaskStatus,
  ParcelData,
} from '../types';
import {
  _ok,
  handleServiceError,
  NotFoundError,
  buildPaginationAndFilters,
  buildWhereClause,
  taskResponse,
} from '../utils';

/**
 * Field mappings for cleaner select queries
 */
const TASK_FIELDS = {
  id: tasks.id,
  parcelId: tasks.parcelId,
  status: tasks.status,
  itemType: tasks.itemType,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
} as const;

const PARCEL_FIELDS = {
  id: parcels.id,
  purchaseOrderNumber: parcels.purchaseOrderNumber,
  parcelFrom: parcels.parcelFrom,
  parcelTo: parcels.parcelTo,
  totalWeight: parcels.totalWeight,
  totalVolume: parcels.totalVolume,
  totalNumberOfParcels: parcels.totalNumberOfParcels,
  packingListNumber: parcels.packingListNumber,
  sourceSystem: parcels.sourceSystem,
  createdAt: parcels.createdAt,
  updatedAt: parcels.updatedAt,
} as const;

const PARCEL_ITEM_FIELDS = {
  id: parcelItems.id,
  productId: parcelItems.productId,
  parcelId: parcelItems.parcelId,
  productQuantity: parcelItems.productQuantity,
  productCode: parcelItems.productCode,
  expiryDate: parcelItems.expiryDate,
  batchNumber: parcelItems.batchNumber,
  weight: parcelItems.weight,
  volume: parcelItems.volume,
  parcelNumber: parcelItems.parcelNumber,
  lineNumber: parcelItems.lineNumber,
  externalRef: parcelItems.externalRef,
  unitOfMeasure: parcelItems.unitOfMeasure,
  currencyUnit: parcelItems.currencyUnit,
  unitPrice: parcelItems.unitPrice,
  messageEsc1: parcelItems.messageEsc1,
  messageEsc2: parcelItems.messageEsc2,
  comments: parcelItems.comments,
  contains: parcelItems.contains,
  sourceSystem: parcelItems.sourceSystem,
  createdAt: parcelItems.createdAt,
  updatedAt: parcelItems.updatedAt,
} as const;

const PRODUCT_FIELDS = {
  id: products.id,
  unidataId: products.unidataId,
  productCode: products.productCode,
  productDescription: products.productDescription,
  type: products.type,
  state: products.state,
  freeCode: products.freeCode,
  standardizationLevel: products.standardizationLevel,
  labels: products.labels,
  sourceSystem: products.sourceSystem,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
} as const;

/**
 * Simplified Task Service with only required methods
 */
export class TaskService implements ITaskService {
  private static instance: TaskService;

  private constructor() {}

  public static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService();
    }
    return TaskService.instance;
  }

  /**
   * Helper method to get total count for pagination
   */
  private async _getTotalCount(table: any, whereClause?: any): Promise<number> {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(whereClause);
    return Number(count);
  }

  /**
   * Helper method to transform task data to TaskWithRelations
   */
  private transformToTaskWithRelations(taskData: any[]): TaskWithRelations[] {
    return taskData.map(task => ({
      id: task.id,
      parcelId: task.parcelId,
      status: task.status as TaskStatus,
      itemType: task.itemType,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      parcel: task.parcel as ParcelData | null,
    }));
  }

  /**
   * Create a new task
   * @param taskData - The task data to create
   * @returns A service response containing the created task
   */
  async createTask(taskData: TaskInsert): Promise<ServiceResponse<Task>> {
    try {
      const [newTask] = await db
        .insert(tasks)
        .values({
          ...taskData,
          status: taskData.status ?? TaskStatus.YET_TO_START,
        })
        .returning();

      return _ok(newTask, taskResponse.success.created, StatusCodes.CREATED);
    } catch (error) {
      throw handleServiceError(error, taskResponse.errors.creationFailed);
    }
  }

  /**
   * Update task status
   * @param id - The task ID
   * @param status - The new status
   * @returns A service response containing the updated task
   */
  async updateTaskStatus(id: string, status: TaskStatus): Promise<ServiceResponse<Task>> {
    try {
      const [updatedTask] = await db
        .update(tasks)
        .set({
          status,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, id))
        .returning();

      if (!updatedTask) {
        throw new NotFoundError(taskResponse.errors.notFound);
      }

      return _ok(updatedTask, taskResponse.success.statusUpdated);
    } catch (error) {
      throw handleServiceError(error, taskResponse.errors.statusUpdateFailed);
    }
  }

  /**
   * Get all tasks with pagination, filtering, and parcel data
   * @param params - Query parameters for filtering and pagination
   * @returns A service response containing paginated tasks with parcel data
   */
  async getAllTasks(
    params: TaskQueryParams,
  ): Promise<ServiceResponse<PaginatedResult<TaskWithRelations>>> {
    try {
      const { offset, limit, page, status, search } = buildPaginationAndFilters(
        params as Record<string, unknown>,
      );

      // Build where clause using utility function
      const whereClause = buildWhereClause(
        { status, search },
        {
          status: tasks.status,
          search: [tasks.itemType],
        },
      );

      // Get total count and paginated data
      const [total, paginatedTasksWithParcels] = await Promise.all([
        this._getTotalCount(tasks, whereClause),
        db
          .select({
            ...TASK_FIELDS,
            parcel: PARCEL_FIELDS,
          })
          .from(tasks)
          .leftJoin(parcels, eq(tasks.parcelId, parcels.id))
          .where(whereClause)
          .orderBy(desc(tasks.createdAt))
          .limit(limit)
          .offset(offset),
      ]);

      const totalPages = Math.ceil(total / limit);
      const tasksWithRelations = this.transformToTaskWithRelations(paginatedTasksWithParcels);

      const result: PaginatedResult<TaskWithRelations> = {
        items: tasksWithRelations,
        total,
        page,
        limit,
        totalPages,
      };

      return _ok(result, taskResponse.success.retrieved);
    } catch (error) {
      throw handleServiceError(error, taskResponse.errors.retrievalFailed);
    }
  }

  /**
   * Get parcel items by parcel ID with product data and packing list number
   * @param parcelId - The parcel ID
   * @param params - Pagination parameters
   * @returns A service response containing paginated parcel items with product data
   */
  async getTasksByParcelId(
    parcelId: string,
    params?: PaginationParams,
  ): Promise<ServiceResponse<PaginatedResult<ParcelItemWithProductData>>> {
    try {
      const { offset, limit, page } = buildPaginationAndFilters(
        (params || {}) as Record<string, unknown>,
      );

      const whereClause = eq(parcelItems.parcelId, parcelId);

      // Get total count and paginated data
      const [total, paginatedParcelItems] = await Promise.all([
        this._getTotalCount(parcelItems, whereClause),
        db
          .select({
            ...PARCEL_ITEM_FIELDS,
            product: PRODUCT_FIELDS,
            packingListNumber: parcels.packingListNumber,
          })
          .from(parcelItems)
          .leftJoin(products, eq(parcelItems.productId, products.id))
          .leftJoin(parcels, eq(parcelItems.parcelId, parcels.id))
          .where(whereClause)
          .orderBy(desc(parcelItems.createdAt))
          .limit(limit)
          .offset(offset),
      ]);

      const totalPages = Math.ceil(total / limit);

      const result: PaginatedResult<ParcelItemWithProductData> = {
        items: paginatedParcelItems,
        total,
        page,
        limit,
        totalPages,
      };

      return _ok(result, taskResponse.success.parcelItemsRetrieved);
    } catch (error) {
      throw handleServiceError(error, taskResponse.errors.parcelItemsRetrievalFailed);
    }
  }
}
