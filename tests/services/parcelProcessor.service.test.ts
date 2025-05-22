import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockFile, mockParcelData, mockParcelStorageResponse, mockProcessorResult } from '../mocks';

// Import the services directly, we'll spy on their methods
import { ParcelProcessorService } from '../../src/services/parcelProcessor.service';
import { FileUploadService } from '../../src/services/fileUpload.service';
import { ParcelStorageService } from '../../src/services/parcelStorage.service';

describe('ParcelProcessorService', () => {
  let parcelProcessorService: ParcelProcessorService;
  let processFileSpy: any;
  let storeExcelDataSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the singleton instance
    // @ts-ignore - Private property access for testing
    ParcelProcessorService.instance = undefined;

    // Get the service instance
    parcelProcessorService = ParcelProcessorService.getInstance();

    // Create spies on the actual method implementations
    processFileSpy = vi.spyOn(FileUploadService.prototype, 'processFile');
    storeExcelDataSpy = vi.spyOn(ParcelStorageService.prototype, 'storeExcelData');

    // Mock their implementations
    processFileSpy.mockResolvedValue(mockParcelData);
    storeExcelDataSpy.mockResolvedValue(mockParcelStorageResponse);
  });

  afterEach(() => {
    // Restore the original implementations
    vi.restoreAllMocks();
  });

  describe('processFileAndStore', () => {
    it('should process file and store data successfully', async () => {
      // Call the method
      const result = await parcelProcessorService.processFileAndStore(mockFile);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProcessorResult);

      // Verify service calls
      expect(processFileSpy).toHaveBeenCalledWith(mockFile);
      expect(storeExcelDataSpy).toHaveBeenCalledWith(mockParcelData[0]);
    });

    it('should throw error when no file is provided', async () => {
      // Use try/catch to explicitly check the error type and message
      try {
        // @ts-ignore - Testing null file case
        await parcelProcessorService.processFileAndStore(null);
        expect(true).toBe(false); // Test should fail if no error is thrown
      } catch (error: any) {
        expect(error.message).toContain('No file uploaded');
      }

      // Verify services weren't called
      expect(processFileSpy).not.toHaveBeenCalled();
      expect(storeExcelDataSpy).not.toHaveBeenCalled();
    });

    it('should handle errors from fileUploadService', async () => {
      // Setup mock to throw error
      const errorMessage = 'File processing error';
      processFileSpy.mockRejectedValueOnce(new Error(errorMessage));

      // Call method and expect error
      await expect(parcelProcessorService.processFileAndStore(mockFile)).rejects.toThrow(
        errorMessage,
      );

      // Verify parcelStorageService wasn't called
      expect(storeExcelDataSpy).not.toHaveBeenCalled();
    });

    it('should handle errors from parcelStorageService', async () => {
      // Setup mocks
      const errorMessage = 'Database storage error';
      storeExcelDataSpy.mockRejectedValueOnce(new Error(errorMessage));

      // Call method and expect error
      await expect(parcelProcessorService.processFileAndStore(mockFile)).rejects.toThrow(
        errorMessage,
      );

      // Verify fileUploadService was called
      expect(processFileSpy).toHaveBeenCalledWith(mockFile);
    });

    it('should handle empty parcel data', async () => {
      // Setup mock to return empty array
      processFileSpy.mockResolvedValueOnce([]);

      // Call the method
      const result = await parcelProcessorService.processFileAndStore(mockFile);

      // Verify results
      expect(result.success).toBe(true);
      expect(result.data?.parsedData).toEqual([]);
      expect(result.data?.storedParcels).toEqual([]);

      // Verify parcelStorageService wasn't called since there's no data to store
      expect(storeExcelDataSpy).not.toHaveBeenCalled();
    });
  });
});
