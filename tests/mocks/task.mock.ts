import { TaskStatus } from '../../src/types';

// Mock task data
export const mockTask = {
  id: 'mock-task-id',
  parcelId: 'mock-parcel-id',
  status: 'Yet to Start',
  itemType: 'Medical Supplies',
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
};

export const mockTaskInsert = {
  parcelId: 'mock-parcel-id',
  itemType: 'Medical Supplies',
  status: TaskStatus.YET_TO_START,
};

export const mockTaskInsertWithoutStatus = {
  parcelId: 'mock-parcel-id',
  itemType: 'Medical Supplies',
};

export const mockUpdatedTask = {
  ...mockTask,
  status: 'In Progress',
  updatedAt: new Date('2024-01-15T11:00:00Z'),
};

// Mock parcel data
export const mockParcel = {
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

export const mockTaskWithParcel = {
  ...mockTask,
  parcel: mockParcel,
};

// Mock product data
export const mockProduct = {
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
};

// Mock parcel item data
export const mockParcelItem = {
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
  product: mockProduct,
  packingListNumber: 'PL-2024-001',
};

// Mock paginated responses
export const mockPaginatedTasksResponse = {
  items: [mockTaskWithParcel],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
};

export const mockPaginatedParcelItemsResponse = {
  items: [mockParcelItem],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
};

// Mock service responses
export const mockTaskServiceResponse = {
  success: true,
  message: 'Task created successfully',
  data: mockTask,
  statusCode: 201,
};

export const mockTaskUpdateServiceResponse = {
  success: true,
  message: 'Task status updated successfully',
  data: mockUpdatedTask,
  statusCode: 200,
};

export const mockTasksListServiceResponse = {
  success: true,
  message: 'Tasks retrieved successfully',
  data: mockPaginatedTasksResponse,
  statusCode: 200,
};

export const mockParcelItemsServiceResponse = {
  success: true,
  message: 'Parcel items retrieved successfully',
  data: mockPaginatedParcelItemsResponse,
  statusCode: 200,
};

// Mock error responses
export const mockTaskNotFoundServiceResponse = {
  success: false,
  message: 'Task not found',
  data: null,
  statusCode: 404,
};

export const mockTaskCreationFailedServiceResponse = {
  success: false,
  message: 'Failed to create task',
  data: null,
  statusCode: 400,
};

export const mockInvalidStatusServiceResponse = {
  success: false,
  message: 'Invalid task status provided',
  data: null,
  statusCode: 400,
};

// Mock request objects
export const mockCreateTaskRequest = {
  body: mockTaskInsert,
  params: {},
  query: {},
};

export const mockUpdateTaskStatusRequest = {
  body: { status: TaskStatus.IN_PROGRESS },
  params: { id: 'mock-task-id' },
  query: {},
};

export const mockGetAllTasksRequest = {
  body: {},
  params: {},
  query: {
    page: '1',
    limit: '10',
    status: TaskStatus.YET_TO_START,
    search: 'medical',
    itemType: 'Medical Supplies',
    parcelId: 'mock-parcel-id',
  },
};

export const mockGetParcelItemsRequest = {
  body: {},
  params: { parcelId: 'mock-parcel-id' },
  query: {
    page: '2',
    limit: '5',
  },
};

// Mock query parameters
export const mockTaskQueryParams = {
  page: 1,
  limit: 10,
  status: TaskStatus.YET_TO_START,
  itemType: 'Medical Supplies',
  search: 'medical',
  parcelId: 'mock-parcel-id',
};

export const mockPaginationParams = {
  page: 2,
  limit: 5,
};

// Status enum values for testing
export const allTaskStatusValues = [
  TaskStatus.YET_TO_START,
  TaskStatus.IN_PROGRESS,
  TaskStatus.PAUSED,
  TaskStatus.SUBMITTED,
];

// Invalid status values for testing
export const invalidStatusValues = [
  'INVALID_STATUS',
  'completed',
  'pending',
  'cancelled',
  '',
  null,
  undefined,
  123,
  {},
  [],
];
