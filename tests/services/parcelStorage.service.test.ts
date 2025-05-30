import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParcelStorageService } from '../../src/services/parcelStorage.service';
import { mockParcelData } from '../mocks';
import { db } from '../../src/config/database.config';
import { parcels, parcelItems, products, tasks } from '../../src/models';

// Create more detailed mocks specific to this test file
const mockDbPayload = mockParcelData[0];

// Mock return values
const mockParcelInsertResult = [{ id: 'mock-parcel-id' }];
const mockProductInsertResult = [{ id: 'mock-product-id' }];
const mockTaskInsertResult = [{ id: 'mock-task-id' }];
const mockExistingProduct = [{ id: 'existing-product-id' }];
const mockEmptyResult: any[] = [];

// Better structured transaction mock
const createMockTx = () => {
  const insertReturn = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(fields => {
      if (fields.id === parcels.id) return mockParcelInsertResult;
      if (fields.id === products.id) return mockProductInsertResult;
      if (fields.id === tasks.id) return mockTaskInsertResult;
      return mockEmptyResult;
    }),
  };

  const selectReturn = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => mockEmptyResult), // Default to no existing products
  };

  const mockTx = {
    insert: vi.fn().mockImplementation(() => insertReturn),
    select: vi.fn().mockImplementation(() => selectReturn),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    })),
  };

  return mockTx;
};

// Mock for transaction
const mockTransaction = vi.fn(callback => callback(createMockTx()));

describe('ParcelStorageService', () => {
  let parcelStorageService: ParcelStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the singleton instance
    // @ts-ignore - Private property access for testing
    ParcelStorageService.instance = undefined;

    // Get the service instance
    parcelStorageService = ParcelStorageService.getInstance();

    // Mock the db transaction
    vi.spyOn(db, 'transaction').mockImplementation(mockTransaction);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ParcelStorageService.getInstance();
      const instance2 = ParcelStorageService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('storeExcelData', () => {
    it('should store excel data successfully', async () => {
      const result = await parcelStorageService.storeExcelData(mockDbPayload);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ parcelId: 'mock-parcel-id' });
      expect(db.transaction).toHaveBeenCalled();
    });

    it('should handle errors correctly', async () => {
      // Setup to throw an error
      mockTransaction.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      await expect(parcelStorageService.storeExcelData(mockDbPayload)).rejects.toThrow(
        'Failed to store Excel data',
      );
    });
  });

  describe('_createParcel', () => {
    it('should create a parcel with correct data', async () => {
      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      const result = await parcelStorageService._createParcel(mockTx, mockDbPayload);

      expect(result).toEqual(mockParcelInsertResult);
      expect(mockTx.insert).toHaveBeenCalledWith(parcels);
      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderNumber: mockDbPayload.parcel.purchaseOrderNumber,
          totalNumberOfParcels: mockDbPayload.parcel.totalNumberOfParcels,
          packingListNumber: mockDbPayload.parcel.packingListNumber,
          totalWeight: mockDbPayload.parcelItems[0].weight,
          totalVolume: mockDbPayload.parcelItems[0].volume,
          sourceSystem: 'FILE_UPLOAD',
        }),
      );
    });

    it('should handle null values correctly', async () => {
      const emptyPayload = {
        parcel: { purchaseOrderNumber: 'TEST-PO' },
        parcelItems: [{ product: { productCode: 'TEST-PROD', productDescription: 'Test Prod' } }],
      };

      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      const result = await parcelStorageService._createParcel(mockTx, emptyPayload);

      expect(result).toEqual(mockParcelInsertResult);
      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          purchaseOrderNumber: 'TEST-PO',
          totalNumberOfParcels: 1,
          packingListNumber: null,
          totalWeight: null,
          totalVolume: null,
        }),
      );
    });
  });

  describe('_createParcelItems', () => {
    it('should create parcel items for each valid item', async () => {
      // @ts-ignore - Accessing private method for testing
      const getOrCreateProductSpy = vi
        .spyOn(parcelStorageService as any, '_getOrCreateProduct')
        .mockResolvedValue('mock-product-id');

      // @ts-ignore - Accessing private method for testing
      const createParcelItemSpy = vi
        .spyOn(parcelStorageService as any, '_createParcelItem')
        .mockResolvedValue(undefined);

      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      await parcelStorageService._createParcelItems(
        mockTx,
        mockDbPayload.parcelItems,
        'mock-parcel-id',
      );

      expect(getOrCreateProductSpy).toHaveBeenCalledTimes(2);
      expect(createParcelItemSpy).toHaveBeenCalledTimes(2);
    });

    it('should skip items without product code', async () => {
      const itemsWithMissingProductCode = [
        {
          ...mockDbPayload.parcelItems[0],
          product: { productCode: null, productDescription: 'Missing Code Product' },
        },
        mockDbPayload.parcelItems[1],
      ];

      // @ts-ignore - Accessing private method for testing
      const getOrCreateProductSpy = vi
        .spyOn(parcelStorageService as any, '_getOrCreateProduct')
        .mockResolvedValue('mock-product-id');

      // @ts-ignore - Accessing private method for testing
      const createParcelItemSpy = vi
        .spyOn(parcelStorageService as any, '_createParcelItem')
        .mockResolvedValue(undefined);

      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      await parcelStorageService._createParcelItems(
        mockTx,
        itemsWithMissingProductCode,
        'mock-parcel-id',
      );

      expect(getOrCreateProductSpy).toHaveBeenCalledTimes(1);
      expect(createParcelItemSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('_getOrCreateProduct', () => {
    it('should return existing product ID if product exists', async () => {
      const mockTx = createMockTx();

      // Setup mock to return existing product
      mockTx.select().limit = vi.fn().mockReturnValue(mockExistingProduct);

      // @ts-ignore - Accessing private method for testing
      const result = await parcelStorageService._getOrCreateProduct(mockTx, {
        productCode: 'EXISTING-CODE',
        productDescription: 'Existing Product',
      });

      expect(result).toBe('existing-product-id');
      expect(mockTx.select).toHaveBeenCalled();
      expect(mockTx.insert).not.toHaveBeenCalled(); // Should not insert if product exists
    });

    it('should create new product if product does not exist', async () => {
      const mockTx = createMockTx();

      // Setup mock to return no existing products
      mockTx.select().limit = vi.fn().mockReturnValue([]);

      // @ts-ignore - Accessing private method for testing
      const result = await parcelStorageService._getOrCreateProduct(mockTx, {
        productCode: 'NEW-CODE',
        productDescription: 'New Product',
      });

      expect(result).toBe('mock-product-id');
      expect(mockTx.select).toHaveBeenCalled();
      expect(mockTx.insert).toHaveBeenCalledWith(products);
      expect(mockTx.insert().values).toHaveBeenCalledWith({
        productCode: 'NEW-CODE',
        productDescription: 'New Product',
        sourceSystem: 'FILE_UPLOAD',
      });
    });

    it('should handle null product code', async () => {
      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      const result = await parcelStorageService._getOrCreateProduct(mockTx, {
        productCode: null,
        productDescription: 'Invalid Product',
      });

      expect(mockTx.select().where).toHaveBeenCalledWith(expect.anything());
      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: '',
        }),
      );
    });

    it('should handle undefined product code', async () => {
      const mockTx = createMockTx();

      // Create a product with undefined code
      const product = { productDescription: 'Undefined Code Product' };
      // @ts-ignore - purposely remove productCode property entirely
      delete product.productCode;

      // @ts-ignore - Accessing private method for testing
      const result = await parcelStorageService._getOrCreateProduct(mockTx, product);

      expect(mockTx.select().where).toHaveBeenCalledWith(expect.anything());
      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: '',
        }),
      );
    });
  });

  describe('_createParcelItem', () => {
    it('should create parcel item with correct data', async () => {
      const mockItem = mockDbPayload.parcelItems[0];
      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      const parseQuantitySpy = vi
        .spyOn(parcelStorageService as any, '_parseQuantity')
        .mockReturnValue(7);

      // @ts-ignore - Accessing private method for testing
      await parcelStorageService._createParcelItem(
        mockTx,
        mockItem,
        'mock-parcel-id',
        'mock-product-id',
      );

      expect(parseQuantitySpy).toHaveBeenCalledWith(mockItem.productQuantity);
      expect(mockTx.insert).toHaveBeenCalledWith(parcelItems);
      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'mock-product-id',
          parcelId: 'mock-parcel-id',
          productQuantity: 7,
          productCode: mockItem.product.productCode,
          unitOfMeasure: 'PCE',
          weight: mockItem.weight,
          volume: mockItem.volume,
          sourceSystem: 'FILE_UPLOAD',
        }),
      );
    });

    it('should handle null values correctly', async () => {
      const emptyItem = {
        productQuantity: null,
        product: { productCode: 'TEST-CODE', productDescription: 'Test Product' },
        parcelNo: null,
        batchNumber: null,
        expiryDate: null,
        weight: null,
        volume: null,
      };

      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      await parcelStorageService._createParcelItem(
        mockTx,
        emptyItem,
        'mock-parcel-id',
        'mock-product-id',
      );

      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          productQuantity: null,
          expiryDate: null,
          batchNumber: null,
          weight: null,
          volume: null,
          unitOfMeasure: null,
        }),
      );
    });

    it('should handle expiry date conversion', async () => {
      const itemWithDate = {
        ...mockDbPayload.parcelItems[0],
        expiryDate: '2023-12-31',
      };

      const mockTx = createMockTx();

      // @ts-ignore - Accessing private method for testing
      await parcelStorageService._createParcelItem(
        mockTx,
        itemWithDate,
        'mock-parcel-id',
        'mock-product-id',
      );

      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          expiryDate: expect.any(Date),
        }),
      );
    });

    it('should handle product with undefined productCode', async () => {
      const mockTx = createMockTx();

      // Create an item with a product that has undefined productCode
      const itemWithUndefinedProductCode = {
        productQuantity: '5.000 PCE',
        product: { productCode: null, productDescription: 'Test Product' },
        parcelNo: '1',
        batchNumber: 'BATCH1',
        expiryDate: null,
        weight: '10.0',
        volume: '20.0',
      };
      // @ts-ignore - purposely remove productCode property entirely
      delete itemWithUndefinedProductCode.product.productCode;

      // @ts-ignore - Accessing private method for testing
      await parcelStorageService._createParcelItem(
        mockTx,
        itemWithUndefinedProductCode as any, // Using type assertion to bypass type checking
        'mock-parcel-id',
        'mock-product-id',
      );

      expect(mockTx.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          productCode: '',
        }),
      );
    });
  });

  describe('_parseQuantity', () => {
    it('should parse quantity string correctly', async () => {
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity('7.000 PCE')).toBe(7);
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity('12.500 KG')).toBe(12.5);
    });

    it('should return null for null or invalid input', async () => {
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity(null)).toBe(null);
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity('ABC')).toBe(null);
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity('')).toBe(null);
    });

    it('should handle edge cases in regex parsing', async () => {
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity(' 7.000')).toBe(null); // Doesn't match the regex pattern
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity('7.000 ')).toBe(7); // Matches the regex pattern
      // @ts-ignore - Accessing private method for testing
      expect(parcelStorageService._parseQuantity('.5 PCE')).toBe(0.5); // Actually parses correctly with the regex
    });
  });

  describe('_parseExpiryDate', () => {
    let consoleWarnSpy: any;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should parse valid date string correctly', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate('2023-12-31');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(11); // December is month 11
      expect(result?.getDate()).toBe(31);
    });

    it('should parse date from object with underscore property', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate({ _: '2023-06-15' });
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2023);
      expect(result?.getMonth()).toBe(5); // June is month 5
      expect(result?.getDate()).toBe(15);
    });

    it('should return null for null input', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate(null);
      expect(result).toBe(null);
    });

    it('should return null for empty string', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate('');
      expect(result).toBe(null);
    });

    it('should return null for object without underscore property', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate({ value: '2023-12-31' });
      expect(result).toBe(null);
    });

    it('should return null and warn for invalid date format', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate('invalid-date');
      expect(result).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid expiry date format: invalid-date');
    });

    it('should return null and warn for date that creates invalid Date object', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate('2023-13-45'); // Invalid month and day
      expect(result).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith('Invalid expiry date format: 2023-13-45');
    });

    it('should handle Date constructor throwing an error', () => {
      // Mock Date constructor to throw an error
      const originalDate = global.Date;
      global.Date = vi.fn().mockImplementation(() => {
        throw new Error('Date constructor error');
      }) as any;

      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate('2023-12-31');
      expect(result).toBe(null);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Error parsing expiry date: 2023-12-31',
        expect.any(Error),
      );

      // Restore original Date constructor
      global.Date = originalDate;
    });

    it('should handle whitespace in date strings', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate('  2023-12-31  ');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2023);
    });

    it('should handle whitespace in object underscore property', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate({ _: '  2023-06-15  ' });
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2023);
    });

    it('should return null for object with empty underscore property after trim', () => {
      // @ts-ignore - Accessing private method for testing
      const result = parcelStorageService._parseExpiryDate({ _: '   ' });
      expect(result).toBe(null);
    });
  });

  describe('Task Management', () => {
    describe('_createTask', () => {
      it('should create a task with default values', async () => {
        const mockTx = createMockTx();

        // @ts-ignore - Accessing private method for testing
        await parcelStorageService._createTask(mockTx, 'mock-parcel-id');

        expect(mockTx.insert).toHaveBeenCalledWith(tasks);
        expect(mockTx.insert().values).toHaveBeenCalledWith({
          parcelId: 'mock-parcel-id',
          status: 'Yet to Start',
          itemType: 'Regular',
        });
      });

      it('should create a task with provided itemType', async () => {
        const mockTx = createMockTx();

        // @ts-ignore - Accessing private method for testing
        await parcelStorageService._createTask(mockTx, 'mock-parcel-id', 'Special');

        expect(mockTx.insert).toHaveBeenCalledWith(tasks);
        expect(mockTx.insert().values).toHaveBeenCalledWith({
          parcelId: 'mock-parcel-id',
          status: 'Yet to Start',
          itemType: 'Special',
        });
      });
    });

    describe('storeExcelData with task creation', () => {
      it('should create a task when storing excel data', async () => {
        // @ts-ignore - Accessing private method for testing
        const createTaskSpy = vi
          .spyOn(parcelStorageService as any, '_createTask')
          .mockResolvedValue(undefined);

        const result = await parcelStorageService.storeExcelData(mockDbPayload);

        expect(result.success).toBe(true);
        expect(createTaskSpy).toHaveBeenCalledWith(
          expect.anything(),
          'mock-parcel-id',
          mockDbPayload.parcel.itemType,
        );
      });

      it('should handle task creation with undefined itemType', async () => {
        const payloadWithoutItemType = {
          ...mockDbPayload,
          parcel: {
            ...mockDbPayload.parcel,
            itemType: undefined,
          },
        };

        // @ts-ignore - Accessing private method for testing
        const createTaskSpy = vi
          .spyOn(parcelStorageService as any, '_createTask')
          .mockResolvedValue(undefined);

        const result = await parcelStorageService.storeExcelData(payloadWithoutItemType);

        expect(result.success).toBe(true);
        expect(createTaskSpy).toHaveBeenCalledWith(expect.anything(), 'mock-parcel-id', undefined);
      });
    });
  });
});
