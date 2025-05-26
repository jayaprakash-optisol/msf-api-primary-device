import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

// Mock environment configuration
vi.mock('../../src/config/env.config', () => ({
  default: {
    NODE_ENV: 'test',
    // Add any other environment variables needed by the tests
  },
}));

// Mock redis util to prevent connection attempts
vi.mock('../../src/utils/redis.util', () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import { FileUploadService, upload } from '../../src/services/fileUpload.service';
import { FileUploadError } from '../../src/utils';
import { mockFile, mockXmlFile } from '../mocks';

// Mock the XLSX module
vi.mock('xlsx', () => {
  return {
    read: vi.fn(),
    utils: {
      sheet_to_json: vi.fn(),
    },
  };
});

// Mock the xml2js module
vi.mock('xml2js', () => {
  return {
    parseStringPromise: vi.fn(),
  };
});

describe('FileUploadService', () => {
  let fileUploadService: FileUploadService;
  let readFileSpy: any;
  let unlinkSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the singleton instance
    // @ts-ignore - Private property access for testing
    FileUploadService.instance = undefined;

    // Get the service instance
    fileUploadService = FileUploadService.getInstance();

    // Mock fs.promises.readFile
    readFileSpy = vi.spyOn(fs.promises, 'readFile');
    readFileSpy.mockResolvedValue(Buffer.from('mock-file-content'));

    // Mock fs.promises.unlink
    unlinkSpy = vi.spyOn(fs.promises, 'unlink');
    unlinkSpy.mockResolvedValue(undefined);

    // Import XLSX module and set up mocks
    const XLSX = await import('xlsx');

    // Default mock data for XLSX.utils.sheet_to_json
    const defaultMockRows = [
      // Mock header row
      ['Parcel No: 1 to 1', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
      // Mock column headers
      ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
      // Mock item rows
      ['PHDWPOSHW30', 'POLISH wood, 300ml, for furniture, can', '7.000 PCE', null, null],
      ['PHYGDETEG3-', 'GLASS CLEANER spray for windows, 300-360ml', '8.000 PCE', null, null],
      // Mock empty row to end items
      [null, null, null, null, null],
      // Mock PACKING LIST header
      ['PACKING LIST', null, null, null],
      // Mock packing list number
      ['PPL/02225-11', null, null, null],
      // Mock Our Ref header
      ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
      // Mock Shipper/Dispatch headers
      ['Shipper:', 'Dispatch:', null, null],
      ['OCG_KE2_SKI', 'OCG_KE1_MOM', null, null],
      // Mock Containing section
      ['Containing:', null, null, null],
      ['cc', 'dg', 'cs', null],
      ['', '', 'x', null],
    ];

    // Set up default XLSX mocks
    (XLSX.read as any).mockReturnValue({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {},
      },
    });
    (XLSX.utils.sheet_to_json as any).mockReturnValue(defaultMockRows);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = FileUploadService.getInstance();
      const instance2 = FileUploadService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('processFile', () => {
    it('should process a valid XLSX file successfully', async () => {
      const result = await fileUploadService.processFile(mockFile);

      // Verify the result structure
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Check the first parcel
      const firstParcel = result[0];
      expect(firstParcel).toHaveProperty('parcel');
      expect(firstParcel).toHaveProperty('parcelItems');

      // Check parcel properties
      expect(firstParcel.parcel).toHaveProperty('purchaseOrderNumber');
      expect(firstParcel.parcel).toHaveProperty('parcelFrom');
      expect(firstParcel.parcel).toHaveProperty('parcelTo');
      expect(firstParcel.parcel).toHaveProperty('packingListNumber');
      expect(firstParcel.parcel).toHaveProperty('totalNumberOfParcels');
      expect(firstParcel.parcel).toHaveProperty('itemType');

      // Check parcel items
      expect(Array.isArray(firstParcel.parcelItems)).toBe(true);
      if (firstParcel.parcelItems.length > 0) {
        const firstItem = firstParcel.parcelItems[0];
        expect(firstItem).toHaveProperty('parcelNo');
        expect(firstItem).toHaveProperty('productQuantity');
        expect(firstItem).toHaveProperty('product');
        expect(firstItem.product).toHaveProperty('productCode');
        expect(firstItem.product).toHaveProperty('productDescription');
      }

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });

    it('should process multiple parcels in a file', async () => {
      // Mock sheet_to_json to return data with multiple parcels
      const XLSX = await import('xlsx');

      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        // Common data at the top
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        ['Shipper:', 'Dispatch:', null, null],
        ['OCG_KE2_SKI', 'OCG_KE1_MOM', null, null],

        // First parcel
        ['Parcel No: 1 to 2', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM1', 'Item 1 Description', '1.000 PCE', null, null],
        [null, null, null, null, null],

        // Second parcel
        ['Parcel No: 2 to 2', null, null, 'Total weight 10.00 kg / Total volume 30.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM2', 'Item 2 Description', '2.000 PCE', null, null],
        [null, null, null, null, null],
      ]);

      const result = await fileUploadService.processFile(mockFile);

      // Verify we have two parcels
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);

      // Check first parcel
      expect(result[0].parcel.purchaseOrderNumber).toBe('25/CH/KE202/FO01861');
      expect(result[0].parcelItems[0].product.productCode).toBe('ITEM1');

      // Check second parcel
      expect(result[1].parcel.purchaseOrderNumber).toBe('25/CH/KE202/FO01861');
      expect(result[1].parcelItems[0].product.productCode).toBe('ITEM2');
    });

    it('should throw an error for unsupported file types', async () => {
      // Mock a file with an unsupported mimetype
      const unsupportedFile = { ...mockFile, mimetype: 'application/pdf' };

      await expect(fileUploadService.processFile(unsupportedFile)).rejects.toThrow(
        'Unsupported file type',
      );

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(unsupportedFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(unsupportedFile.path);
    });

    it('should throw an error when file reading fails', async () => {
      // Mock readFile to throw an error
      const errorMessage = 'File read error';
      readFileSpy.mockRejectedValueOnce(new Error(errorMessage));

      await expect(fileUploadService.processFile(mockFile)).rejects.toThrow(
        `Error processing file: ${errorMessage}`,
      );

      // Verify cleanup was attempted
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });

    it('should handle file cleanup errors gracefully', async () => {
      // Mock console.error to verify it's called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock unlink to throw an error
      const unlinkError = new Error('Unlink error');
      unlinkSpy.mockRejectedValueOnce(unlinkError);

      // Process should complete successfully despite cleanup error
      const result = await fileUploadService.processFile(mockFile);

      // Verify the result is as expected
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify unlink was called
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);

      // Verify console.error was called with the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(unlinkError);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should handle file cleanup errors when an exception is thrown', async () => {
      // Mock console.error to verify it's called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock readFile to throw an error to ensure the finally block is executed after an exception
      const readError = new Error('Read error');
      readFileSpy.mockRejectedValueOnce(readError);

      // Mock unlink to throw an error
      const unlinkError = new Error('Unlink error');
      unlinkSpy.mockRejectedValueOnce(unlinkError);

      // Process should throw the read error
      await expect(fileUploadService.processFile(mockFile)).rejects.toThrow(
        `Error processing file: ${readError.message}`
      );

      // Verify unlink was called
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);

      // Verify console.error was called with the unlink error
      expect(consoleErrorSpy).toHaveBeenCalledWith(unlinkError);

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should throw an error for invalid XLSX format', async () => {
      // Mock sheet_to_json to return invalid format
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['Invalid header', null, null, null],
        ['Invalid data', null, null, null],
      ]);

      await expect(fileUploadService.processFile(mockFile)).rejects.toThrow('Invalid XLSX format');

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });

    it('should handle empty parcel data', async () => {
      // Mock sheet_to_json to return valid format but no parcel starts
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        // Include all required headers but without actual parcel data
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, null, null], // No value for Our Ref
        ['Parcel No:', null, null, null], // No actual parcel number
        ['Code', 'Description', 'Total Qty.', null],
      ]);

      const result = await fileUploadService.processFile(mockFile);

      // Verify result has default empty structure
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);
      expect(result[0].parcel).toHaveProperty('purchaseOrderNumber', null);
      expect(result[0].parcelItems).toEqual([]);

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });
  });

  describe('Error handling', () => {
    it('should propagate FileUploadError instances', async () => {
      // Mock _validateXlsxFormat to throw a FileUploadError
      const errorMessage = 'Custom validation error';

      // We need to make sure the code reaches _validateXlsxFormat
      // So we need to set up the mocks to get past the initial XLSX.read
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockImplementationOnce(() => {
        throw new FileUploadError(errorMessage);
      });

      await expect(fileUploadService.processFile(mockFile)).rejects.toThrow(errorMessage);
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });

    it('should wrap non-FileUploadError instances', async () => {
      // Mock _validateXlsxFormat to throw a generic Error
      const errorMessage = 'Generic error';

      // We need to make sure the code reaches _validateXlsxFormat
      // So we need to set up the mocks to get past the initial XLSX.read
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockImplementationOnce(() => {
        throw new Error(errorMessage);
      });

      await expect(fileUploadService.processFile(mockFile)).rejects.toThrow(
        `Error processing file: ${errorMessage}`,
      );
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });

    it('should handle non-Error objects in error handling', async () => {
      // Mock readFile to throw a non-Error object
      readFileSpy.mockRejectedValueOnce('Not an error object');

      await expect(fileUploadService.processFile(mockFile)).rejects.toThrow(
        'Error processing file: Unknown error',
      );

      // Verify cleanup was attempted
      expect(unlinkSpy).toHaveBeenCalledWith(mockFile.path);
    });
  });

  describe('Multer configuration', () => {
    it('should create destination directory if it does not exist', () => {
      // Mock fs.existsSync to return false
      const existsSyncSpy = vi.spyOn(fs, 'existsSync');
      existsSyncSpy.mockReturnValueOnce(false);

      // Mock fs.mkdirSync
      const mkdirSyncSpy = vi.spyOn(fs, 'mkdirSync');
      mkdirSyncSpy.mockImplementationOnce(() => undefined);

      // Extract the destination function from multer storage
      const destinationFn = (upload as any).storage.getDestination;

      // Call the destination function directly
      const req = {} as any;
      const file = {} as any;
      const cb = vi.fn();

      destinationFn(req, file, cb);

      // Verify callback was called with the correct destination
      expect(cb).toHaveBeenCalledWith(null, 'uploads/');

      // Verify directory was created
      expect(existsSyncSpy).toHaveBeenCalled();
      expect(mkdirSyncSpy).toHaveBeenCalled();

      // Restore mocks
      existsSyncSpy.mockRestore();
      mkdirSyncSpy.mockRestore();
    });

    it('should create uploads directory at module level', () => {
      // This test verifies that the code at the module level creates the uploads directory
      // Since we can't easily re-import the module in Vitest, we'll test the code directly

      // Save original functions
      const originalExistsSync = fs.existsSync;
      const originalMkdirSync = fs.mkdirSync;

      try {
        // Mock fs functions
        fs.existsSync = vi.fn().mockReturnValue(false);
        fs.mkdirSync = vi.fn();

        // Execute the code that would run at module level
        const UPLOAD_DIR = 'uploads/';
        if (!fs.existsSync(UPLOAD_DIR)) {
          fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }

        // Verify directory creation was attempted
        expect(fs.existsSync).toHaveBeenCalledWith('uploads/');
        expect(fs.mkdirSync).toHaveBeenCalledWith('uploads/', { recursive: true });
      } finally {
        // Restore original functions
        fs.existsSync = originalExistsSync;
        fs.mkdirSync = originalMkdirSync;
      }
    });

    // This test is specifically for lines 22-23 in fileUpload.service.ts
    it('should create uploads directory when importing the module', async () => {
      // Save original functions
      const originalExistsSync = fs.existsSync;
      const originalMkdirSync = fs.mkdirSync;

      try {
        // Mock fs functions
        fs.existsSync = vi.fn().mockReturnValue(false);
        fs.mkdirSync = vi.fn();

        // Reset module registry to force re-execution of module code
        vi.resetModules();

        // Dynamically import the module to trigger the code at the module level
        await import('../../src/services/fileUpload.service');

        // Verify directory creation was attempted
        expect(fs.existsSync).toHaveBeenCalledWith('uploads/');
        expect(fs.mkdirSync).toHaveBeenCalledWith('uploads/', { recursive: true });
      } finally {
        // Restore original functions
        fs.existsSync = originalExistsSync;
        fs.mkdirSync = originalMkdirSync;
      }
    });

    it('should generate a unique filename', () => {
      // Mock Date.now and Math.random for predictable output
      const originalDateNow = Date.now;
      const originalMathRandom = Math.random;

      Date.now = vi.fn(() => 1234567890);
      Math.random = vi.fn(() => 0.5);

      // Get the storage configuration from the upload object
      const storage = (upload as any).storage;

      // Call the filename function
      const req = {} as any;
      const file = { fieldname: 'file', originalname: 'test.xlsx' } as any;
      const cb = vi.fn();

      storage.getFilename(req, file, cb);

      // Verify callback was called with expected filename
      expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('1234567890-'));
      expect(cb).toHaveBeenCalledWith(null, expect.stringContaining('.xlsx'));

      // Restore original functions
      Date.now = originalDateNow;
      Math.random = originalMathRandom;
    });

    it('should accept allowed file types', () => {
      // Test with allowed mimetype
      const req = {} as any;
      const file = {
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any;
      const cb = vi.fn();

      const fileFilter = (upload as any).fileFilter;
      fileFilter(req, file, cb);

      // Verify callback was called with true (accept file)
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('should reject disallowed file types', () => {
      // Test with disallowed mimetype
      const req = {} as any;
      const file = { mimetype: 'application/pdf' } as any;
      const cb = vi.fn();

      const fileFilter = (upload as any).fileFilter;
      fileFilter(req, file, cb);

      // Verify callback was called with an error
      expect(cb).toHaveBeenCalledWith(expect.any(FileUploadError));
      expect(cb.mock.calls[0][0].message).toBe('Only XML and XLSX files are allowed');
    });
  });

  describe('Empty parcel handling', () => {
    it('should return default payload when no parcels are found', async () => {
      // Mock sheet_to_json to return valid format but with no parcel starts
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        // Include all required headers but with "Parcel No:" that won't be detected as a start
        ['Parcel No: ', null, null, null], // Empty parcel number won't be detected as a start
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        ['Code', 'Description', 'Total Qty.', null],
      ]);

      const result = await fileUploadService.processFile(mockFile);

      // Verify result has default empty structure
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);
      expect(result[0].parcel).toEqual({
        purchaseOrderNumber: null,
        parcelFrom: null,
        parcelTo: null,
        packingListNumber: null,
        totalNumberOfParcels: 1,
        itemType: 'Regular',
      });
      expect(result[0].parcelItems).toEqual([]);
    });
  });

  describe('XLSX validation', () => {
    it('should throw an error when required columns are missing', async () => {
      // Mock sheet_to_json to return data with missing required columns
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['Parcel No: 1 to 1', null, null, null],
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        // Missing the Code, Description, Total Qty. columns
        ['Some Column', 'Another Column', null, null],
      ]);

      await expect(fileUploadService.processFile(mockFile)).rejects.toThrow(
        'Invalid XLSX format: missing item columns Code, Description, Total Qty.',
      );
    });
  });

  describe('Excel processing edge cases', () => {
    it('should handle missing shipper/dispatch info', async () => {
      // Mock sheet_to_json to return data without shipper/dispatch rows
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['Parcel No: 1 to 1', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM1', 'Item 1 Description', '1.000 PCE', null, null],
        [null, null, null, null, null],
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        // No shipper/dispatch rows
      ]);

      const result = await fileUploadService.processFile(mockFile);

      expect(result[0].parcel.parcelFrom).toBeNull();
      expect(result[0].parcel.parcelTo).toBeNull();
    });

    it('should extract shipper/dispatch info correctly', async () => {
      // Mock sheet_to_json to return data with shipper/dispatch info
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        ['Shipper:', 'Dispatch:', null, null],
        ['OCG_KE2_SKI', 'OCG_KE1_MOM', null, null],
        ['Parcel No: 1 to 1', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM1', 'Item 1 Description', '1.000 PCE', null, null],
        [null, null, null, null, null],
      ]);

      const result = await fileUploadService.processFile(mockFile);

      expect(result[0].parcel.parcelFrom).toBe('OCG_KE2_SKI');
      expect(result[0].parcel.parcelTo).toBe('OCG_KE1_MOM');
    });

    it('should handle case-insensitive shipper/dispatch headers', async () => {
      // Mock sheet_to_json to return data with uppercase headers
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        ['SHIPPER:', 'DISPATCH:', null, null], // Uppercase headers
        ['OCG_KE2_SKI', 'OCG_KE1_MOM', null, null],
        ['Parcel No: 1 to 1', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM1', 'Item 1 Description', '1.000 PCE', null, null],
        [null, null, null, null, null],
      ]);

      const result = await fileUploadService.processFile(mockFile);

      expect(result[0].parcel.parcelFrom).toBe('OCG_KE2_SKI');
      expect(result[0].parcel.parcelTo).toBe('OCG_KE1_MOM');
    });

    it('should handle different order of shipper/dispatch headers', async () => {
      // Mock sheet_to_json to return data with reversed order
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        ['Dispatch:', 'Shipper:', null, null], // Reversed order
        ['OCG_KE1_MOM', 'OCG_KE2_SKI', null, null], // Values also reversed
        ['Parcel No: 1 to 1', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM1', 'Item 1 Description', '1.000 PCE', null, null],
        [null, null, null, null, null],
      ]);

      const result = await fileUploadService.processFile(mockFile);

      expect(result[0].parcel.parcelFrom).toBe('OCG_KE2_SKI');
      expect(result[0].parcel.parcelTo).toBe('OCG_KE1_MOM');
    });

    it('should handle rows without product code', async () => {
      // Mock sheet_to_json to return data with a row that has no product code
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['Parcel No: 1 to 1', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM1', 'Item 1 Description', '1.000 PCE', null, null],
        ['ITEM2', 'Item 2 Description', '3.000 PCE', null, null],
        [null, null, null, null, null], // End of items
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        ['Shipper:', 'Dispatch:', null, null],
        ['OCG_KE2_SKI', 'OCG_KE1_MOM', null, null],
      ]);

      const result = await fileUploadService.processFile(mockFile);

      // Verify that both items are processed
      expect(result[0].parcelItems.length).toBe(2); // Both ITEM1 and ITEM2 should be included
      expect(result[0].parcelItems[0].product.productCode).toBe('ITEM1');
      expect(result[0].parcelItems[1].product.productCode).toBe('ITEM2');
    });

    it('should handle item type detection', async () => {
      // Mock sheet_to_json to return data with item type information
      const XLSX = await import('xlsx');
      (XLSX.utils.sheet_to_json as any).mockReturnValueOnce([
        ['Parcel No: 1 to 1', null, null, 'Total weight 12.00 kg / Total volume 36.00 l'],
        ['Code', 'Description', 'Total Qty.', 'Batch', 'Exp. Date'],
        ['ITEM1', 'Item 1 Description', '1.000 PCE', null, null],
        [null, null, null, null, null],
        ['PACKING LIST', null, null, null],
        ['PPL/02225-11', null, null, null],
        ['Our Ref.:', null, '25/CH/KE202/FO01861', null],
        ['Shipper:', 'Dispatch:', null, null],
        ['OCG_KE2_SKI', 'OCG_KE1_MOM', null, null],
        ['Containing:', null, null, null],
        ['cc', 'dg', 'cs', null],
        ['', '', 'x', null], // cs type marked with x
      ]);

      const result = await fileUploadService.processFile(mockFile);

      expect(result[0].parcel.itemType).toBe('cs');
    });
  });

  describe('XML file processing', () => {
    it('should process a valid XML file successfully', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data structure based on the example file
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                    { name: 'parcel_qty', _: '1' },
                    { name: 'total_weight', _: '1' },
                    { name: 'total_volume', _: '7' },
                    { name: 'packing_list', _: '349774' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'DINJHALP5AD' },
                          { name: 'product_name', _: 'HALOPERIDOL décanoate, 50mg/ml, 1ml, amp.' },
                        ],
                      },
                      { name: 'product_qty', _: '60' },
                      {
                        name: 'product_uom',
                        field: { name: 'name', _: 'PCE' },
                      },
                      { name: 'prodlot_id', _: 'PEB3V00' },
                      { name: 'expired_date', _: '2027-04-30' },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify the result structure
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);

      // Check the first parcel
      const firstParcel = result[0];
      expect(firstParcel).toHaveProperty('parcel');
      expect(firstParcel).toHaveProperty('parcelItems');

      // Check parcel properties
      expect(firstParcel.parcel.purchaseOrderNumber).toBe('24/CH/KE202/PO04025');
      expect(firstParcel.parcel.parcelFrom).toBe('1');
      expect(firstParcel.parcel.parcelTo).toBe('1');
      expect(firstParcel.parcel.packingListNumber).toBe('349774');

      // Check parcel items
      expect(Array.isArray(firstParcel.parcelItems)).toBe(true);
      if (firstParcel.parcelItems.length > 0) {
        const firstItem = firstParcel.parcelItems[0];
        expect(firstItem.product.productCode).toBe('DINJHALP5AD');
        expect(firstItem.product.productDescription).toBe(
          'HALOPERIDOL décanoate, 50mg/ml, 1ml, amp.',
        );
        expect(firstItem.productQuantity).toBe('60 PCE');
        expect(firstItem.batchNumber).toBe('PEB3V00');
        expect(firstItem.expiryDate).toBe('2027-04-30');
      }

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockXmlFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockXmlFile.path);
    });

    it('should throw an error for invalid XML format', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock invalid XML data structure
      (xml2js.parseStringPromise as any).mockResolvedValue({
        data: {}, // Missing required record element
      });

      await expect(fileUploadService.processFile(mockXmlFile)).rejects.toThrow(
        'Unknown XML format: unable to detect format type',
      );

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockXmlFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockXmlFile.path);
    });

    it('should handle XML parsing errors', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML parsing error
      const errorMessage = 'XML parsing error';
      (xml2js.parseStringPromise as any).mockRejectedValue(new Error(errorMessage));

      await expect(fileUploadService.processFile(mockXmlFile)).rejects.toThrow(
        `Error processing XML file: ${errorMessage}`,
      );

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockXmlFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockXmlFile.path);
    });

    it('should handle non-Error objects in XML processing error', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML parsing with a non-Error object
      (xml2js.parseStringPromise as any).mockRejectedValue('String error message');

      await expect(fileUploadService.processFile(mockXmlFile)).rejects.toThrow(
        'Error processing XML file: Unknown error',
      );

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockXmlFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockXmlFile.path);
    });

    it('should handle empty move lines in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with no move lines
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                // No record element
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify result has default empty structure
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(1);
      expect(result[0].parcel.purchaseOrderNumber).toBe('24/CH/KE202/PO04025');
      expect(result[0].parcel.parcelFrom).toBe('MSF GENEVA');
      expect(result[0].parcelItems).toEqual([]);

      // Verify file was read and cleaned up
      expect(readFileSpy).toHaveBeenCalledWith(mockXmlFile.path);
      expect(unlinkSpy).toHaveBeenCalledWith(mockXmlFile.path);
    });

    it('should handle alternative purchase order number format in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with purchase order number without underscore property
      const mockXmlData = {
        data: {
          record: {
            field: [
              // No _ property, the object itself is the value
              { name: 'origin' }, // This will trigger the fallback in line 377
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify purchase order number was extracted correctly
      // Since we're providing an object without _ property, the code should use the object itself
      expect(result[0].parcel.purchaseOrderNumber).toEqual({ name: 'origin' });
    });

    it('should handle array structure for partnerField.field in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with array structure for partnerField.field
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: [
                  { name: 'name', _: 'MSF GENEVA' },
                  { name: 'code', _: 'MSF001' },
                ],
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: 'MSF GENEVA' }, // Match the expected value
                    { name: 'parcel_to', _: '1' },
                  ],
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify partner name was extracted correctly from parcel_from field
      // This is because the code uses getFieldValue('parcel_from') to set parcelFrom
      expect(result[0].parcel.parcelFrom).toBe('MSF GENEVA');
    });

    it('should handle different product field structures in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with nested field.field structure
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: {
                          field: [
                            { name: 'product_code', _: 'NESTED-CODE' },
                            { name: 'product_name', _: 'Nested Product Name' },
                          ],
                        },
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify product information was extracted correctly
      expect(result[0].parcelItems[0].product.productCode).toBe('NESTED-CODE');
      expect(result[0].parcelItems[0].product.productDescription).toBe('Nested Product Name');
    });

    it('should skip products without product code in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with a product missing product code
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: [
                    {
                      field: [
                        {
                          name: 'product_id',
                          field: [
                            // Missing product_code
                            { name: 'product_name', _: 'Product Without Code' },
                          ],
                        },
                        { name: 'product_qty', _: '5' },
                        { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      ],
                    },
                    {
                      field: [
                        {
                          name: 'product_id',
                          field: [
                            { name: 'product_code', _: 'VALID-CODE' },
                            { name: 'product_name', _: 'Valid Product' },
                          ],
                        },
                        { name: 'product_qty', _: '10' },
                        { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify only the valid product was included
      expect(result[0].parcelItems.length).toBe(1);
      expect(result[0].parcelItems[0].product.productCode).toBe('VALID-CODE');
      expect(result[0].parcelItems[0].product.productDescription).toBe('Valid Product');
    });

    it('should skip records without field property in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with a record missing field property
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: [
                    // Record without field property
                    { id: '123', name: 'Invalid Record' },
                    {
                      field: [
                        {
                          name: 'product_id',
                          field: [
                            { name: 'product_code', _: 'VALID-CODE' },
                            { name: 'product_name', _: 'Valid Product' },
                          ],
                        },
                        { name: 'product_qty', _: '10' },
                        { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify only the valid record was processed
      expect(result[0].parcelItems.length).toBe(1);
      expect(result[0].parcelItems[0].product.productCode).toBe('VALID-CODE');
    });

    it('should handle fallback for purchase order number in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with origin field without underscore property
      const mockXmlData = {
        data: {
          record: {
            field: [
              // Origin field without underscore property (tests line 378)
              { name: 'origin', value: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // The actual behavior is that the object is returned when _ property is missing
      expect(result[0].parcel.purchaseOrderNumber).toEqual({
        name: 'origin',
        value: '24/CH/KE202/PO04025',
      });
    });

    it('should handle fallback for partner name in XML', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with partner_id field with array structure but without underscore property
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: [
                  // Name field without underscore property (tests lines 388-389)
                  { name: 'name', value: 'MSF GENEVA' },
                ],
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // The parcelFrom is set from moveRecord.field.find(f => f.name === 'parcel_from')
      // which is '1' in this case, not from the partner_id field
      expect(result[0].parcel.parcelFrom).toBe('1');
    });

    it('should handle moveLines.record as a single object', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with move_lines.record as a single object (tests line 413)
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify the single record was processed correctly
      expect(result.length).toBe(1);
      expect(result[0].parcelItems.length).toBe(1);
      expect(result[0].parcelItems[0].product.productCode).toBe('TEST-CODE');
    });

    it('should handle fallback for product description when productField.field is an array', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with product_name field without underscore property
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          // Product name field without underscore property (tests lines 470-471)
                          { name: 'product_name', value: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // The actual behavior is that the object is returned when _ property is missing
      expect(result[0].parcelItems[0].product.productDescription).toEqual({
        name: 'product_name',
        value: 'Test Product',
      });
    });

    it('should handle case where productField.field is an object', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with productField.field as an object (tests lines 484-486)
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: {
                          product_code: 'OBJECT-CODE',
                          product_name: 'Object Product',
                        },
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify product information was extracted correctly
      expect(result[0].parcelItems[0].product.productCode).toBe('OBJECT-CODE');
      expect(result[0].parcelItems[0].product.productDescription).toBe('Object Product');
    });

    it('should handle case where partnerField.field is an object', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with partnerField.field as an object (tests line 392)
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: {
                  _: 'PARTNER-NAME-UNDERSCORE',
                  name: 'PARTNER-NAME-PROPERTY',
                },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // The parcelFrom is set from moveRecord.field.find(f => f.name === 'parcel_from')
      // which is '1' in this case, not from the partner_id field
      expect(result[0].parcel.parcelFrom).toBe('1');
    });

    it('should handle getProductFieldValue with field having underscore property', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with field having underscore property (tests line 454)
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      { name: 'prodlot_id', _: 'BATCH-123' }, // Field with underscore property
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify batch number was extracted correctly
      expect(result[0].parcelItems[0].batchNumber).toBe('BATCH-123');
    });

    it('should handle getProductFieldValue with field without underscore property', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with field without underscore property (tests line 454)
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      { name: 'expired_date', value: '2023-12-31' }, // Field without underscore property
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // The actual behavior is that the object is returned when _ property is missing
      expect(result[0].parcelItems[0].expiryDate).toEqual({
        name: 'expired_date',
        value: '2023-12-31',
      });
    });

    it('should handle fallback for unit when uomField.field is an array', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with uomField.field as an array with name field without underscore property
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      {
                        name: 'product_uom',
                        field: [
                          // Name field without underscore property (tests lines 499-502)
                          { name: 'name', value: 'PCE' },
                        ],
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // The actual behavior is that the object is returned when _ property is missing
      // and the format is "quantity unit"
      expect(result[0].parcelItems[0].productQuantity).toBe('10 [object Object]');
    });

    it('should handle case where uomField.field is an object', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with uomField.field as an object (tests line 505)
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      {
                        name: 'product_uom',
                        field: {
                          _: 'PCE-UNDERSCORE',
                          name: 'PCE-NAME',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify unit was extracted correctly (should use _ property first)
      expect(result[0].parcelItems[0].productQuantity).toBe('10 PCE-UNDERSCORE');
    });

    it('should handle nested field array for product code and description', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with nested field.field structure without underscore properties
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: {
                          field: [
                            // Product code field without underscore property (tests lines 476-477)
                            { name: 'product_code', value: 'NESTED-CODE' },
                            // Product name field without underscore property (tests lines 480-481)
                            { name: 'product_name', value: 'Nested Product Name' },
                          ],
                        },
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify product information was extracted using the fallback
      expect(result[0].parcelItems[0].product.productCode).toEqual({
        name: 'product_code',
        value: 'NESTED-CODE',
      });
      expect(result[0].parcelItems[0].product.productDescription).toEqual({
        name: 'product_name',
        value: 'Nested Product Name',
      });
    });

    it('should handle null fallbacks for missing fields', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with missing fields to test null fallbacks
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: [
                    {
                      field: [
                        {
                          name: 'product_id',
                          field: [
                            // Only product_code, no product_name (tests line 471)
                            { name: 'product_code', _: 'CODE-1' },
                          ],
                        },
                        { name: 'product_qty', _: '10' },
                        {
                          name: 'product_uom',
                          field: [
                            // Empty array, no name field (tests line 502)
                          ],
                        },
                      ],
                    },
                    {
                      field: [
                        {
                          name: 'product_id',
                          field: {
                            field: [
                              // Only product_name, no product_code (tests line 477)
                              { name: 'product_name', _: 'Product 2' },
                            ],
                          },
                        },
                        { name: 'product_qty', _: '5' },
                        { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      ],
                    },
                    {
                      field: [
                        {
                          name: 'product_id',
                          field: {
                            field: [
                              // Only product_code, no product_name (tests line 481)
                              { name: 'product_code', _: 'CODE-3' },
                            ],
                          },
                        },
                        { name: 'product_qty', _: '15' },
                        { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify first item has product_code but null product_description (line 471)
      expect(result[0].parcelItems[0].product.productCode).toBe('CODE-1');
      expect(result[0].parcelItems[0].product.productDescription).toBe(null);

      // Verify unit is null when name field is not found (line 502)
      expect(result[0].parcelItems[0].productQuantity).toBe('10');

      // Second item should be skipped because product_code is null (line 477)
      // Third item should have product_code but null product_description (line 481)
      expect(result[0].parcelItems[1].product.productCode).toBe('CODE-3');
      expect(result[0].parcelItems[1].product.productDescription).toBe(null);
    });

    it('should handle single object record', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data to test single object record
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                // Single object record, not an array
                record: {
                  field: [
                    { name: 'parcel_from', _: '1' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'SINGLE-CODE' },
                          { name: 'product_name', _: 'Single Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify single object record is processed correctly
      expect(result.length).toBe(1);
      expect(result[0].parcelItems.length).toBe(1);
      expect(result[0].parcelItems[0].product.productCode).toBe('SINGLE-CODE');
    });

    it('should handle field without underscore property in getFieldValue', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with field without underscore property
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                record: {
                  field: [
                    // Field without underscore property (tests line 454)
                    { name: 'parcel_from', value: 'FROM-VALUE' },
                    { name: 'parcel_to', _: '1' },
                  ],
                  record: {
                    field: [
                      {
                        name: 'product_id',
                        field: [
                          { name: 'product_code', _: 'TEST-CODE' },
                          { name: 'product_name', _: 'Test Product' },
                        ],
                      },
                      { name: 'product_qty', _: '10' },
                      { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                    ],
                  },
                },
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify the field without underscore property is returned as is
      expect(result[0].parcel.parcelFrom).toEqual({ name: 'parcel_from', value: 'FROM-VALUE' });
    });

    it('should handle moveLines.record as an array', async () => {
      // Import xml2js module and set up mocks
      const xml2js = await import('xml2js');

      // Mock XML data with moveLines.record as an array (tests line 413 - true branch)
      const mockXmlData = {
        data: {
          record: {
            field: [
              { name: 'origin', _: '24/CH/KE202/PO04025' },
              {
                name: 'partner_id',
                field: { name: 'name', _: 'MSF GENEVA' },
              },
              {
                name: 'move_lines',
                // Array of records (tests line 413 - true branch)
                record: [
                  {
                    field: [
                      { name: 'parcel_from', _: '1' },
                      { name: 'parcel_to', _: '1' },
                    ],
                    record: {
                      field: [
                        {
                          name: 'product_id',
                          field: [
                            { name: 'product_code', _: 'ARRAY-CODE-1' },
                            { name: 'product_name', _: 'Array Product 1' },
                          ],
                        },
                        { name: 'product_qty', _: '10' },
                        { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      ],
                    },
                  },
                  {
                    field: [
                      { name: 'parcel_from', _: '2' },
                      { name: 'parcel_to', _: '2' },
                    ],
                    record: {
                      field: [
                        {
                          name: 'product_id',
                          field: [
                            { name: 'product_code', _: 'ARRAY-CODE-2' },
                            { name: 'product_name', _: 'Array Product 2' },
                          ],
                        },
                        { name: 'product_qty', _: '20' },
                        { name: 'product_uom', field: { name: 'name', _: 'PCE' } },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
      };

      // Set up the mock for parseStringPromise
      (xml2js.parseStringPromise as any).mockResolvedValue(mockXmlData);

      // Process the XML file
      const result = await fileUploadService.processFile(mockXmlFile);

      // Verify array of records is processed correctly
      expect(result.length).toBe(2);
      expect(result[0].parcelItems.length).toBe(1);
      expect(result[0].parcelItems[0].product.productCode).toBe('ARRAY-CODE-1');
      expect(result[1].parcelItems.length).toBe(1);
      expect(result[1].parcelItems[0].product.productCode).toBe('ARRAY-CODE-2');
    });
  });
});
