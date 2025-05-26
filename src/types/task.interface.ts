import { type tasks, type parcelItems, parcels, products } from '../models';
import {
  type ServiceResponse,
  type PaginatedResult,
  type PaginationParams,
} from './common.interface';

// Define task types
export type Task = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type TaskUpdate = Partial<Omit<TaskInsert, 'id' | 'createdAt'>>;
export type ParcelData = typeof parcels.$inferSelect;
export type ProductData = typeof products.$inferSelect;

export enum TaskStatus {
  YET_TO_START = 'Yet to Start',
  IN_PROGRESS = 'In Progress',
  PAUSED = 'Paused',
  SUBMITTED = 'Submitted',
}

// Define parcel item type
export type ParcelItemData = typeof parcelItems.$inferSelect;

// Parcel item with product data and packing list number
export interface ParcelItemWithProductData extends ParcelItemData {
  product?: ProductData | null;
  packingListNumber?: string | null;
}

// Task with related data
export interface TaskWithRelations {
  id: string;
  parcelId: string | null;
  status: TaskStatus;
  itemType: string | null;
  createdAt: Date;
  updatedAt: Date;
  parcel?: ParcelData | null;
  parcelItems?: Array<ParcelItemData>;
}

// Task query parameters
export interface TaskQueryParams extends PaginationParams {
  status?: TaskStatus;
  itemType?: string;
  search?: string;
  parcelId?: string;
}

/**
 * Simplified Task service interface with only required methods
 */
export interface ITaskService {
  /**
   * Create a new task
   * @param taskData - The task data to create
   * @returns A service response containing the created task
   */
  createTask(taskData: TaskInsert): Promise<ServiceResponse<Task>>;

  /**
   * Update task status
   * @param id - The task ID
   * @param status - The new status
   * @returns A service response containing the updated task
   */
  updateTaskStatus(id: string, status: TaskStatus): Promise<ServiceResponse<Task>>;

  /**
   * Get all tasks with pagination, filtering, and parcel data
   * @param params - Query parameters for filtering and pagination
   * @returns A service response containing paginated tasks with parcel data
   */
  getAllTasks(
    params: TaskQueryParams,
  ): Promise<ServiceResponse<PaginatedResult<TaskWithRelations>>>;

  /**
   * Get parcel items by parcel ID with product data and packing list number
   * @param parcelId - The parcel ID
   * @param params - Pagination parameters
   * @returns A service response containing paginated parcel items with product data
   */
  getTasksByParcelId(
    parcelId: string,
    params?: PaginationParams,
  ): Promise<ServiceResponse<PaginatedResult<ParcelItemWithProductData>>>;
}
