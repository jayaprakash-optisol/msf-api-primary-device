import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { mockFile, mockProcessorResult } from '../mocks';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/test-utils';
import fs from 'fs/promises';
import path from 'path';

// Import dependencies directly
import { FileUploadController } from '../../src/controllers/fileUpload.controller';
import { ParcelProcessorService } from '../../src/services/parcelProcessor.service';
import * as utils from '../../src/utils';

describe('FileUploadController', () => {
  let fileUploadController: FileUploadController;
  let processFileAndStoreSpy: any;
  let sendSuccessSpy: any;
  let req: any;
  let res: any;
  let next: any;

  // Create mock file on disk to simulate real file
  const testFilePath = mockFile.path;

  // Helper function to create test file
  async function createTestFile() {
    try {
      // Create uploads directory if it doesn't exist
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      // Write test file
      await fs.writeFile(testFilePath, 'test file content');
    } catch (error) {
      console.error('Error creating test file:', error);
    }
  }

  // Helper function to clean up test file
  async function cleanupTestFile() {
    try {
      await fs.unlink(testFilePath).catch(() => {
        /* ignore errors */
      });
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create test file before each test
    await createTestFile();

    // Setup request, response, and next using the test utils
    req = createMockRequest({ file: mockFile });
    const mockRes = createMockResponse();
    res = mockRes.res;
    next = createMockNext();

    // Create controller
    fileUploadController = new FileUploadController();

    // Spy on service method
    processFileAndStoreSpy = vi.spyOn(ParcelProcessorService.prototype, 'processFileAndStore');
    processFileAndStoreSpy.mockResolvedValue({
      success: true,
      message: 'Operation successful',
      data: mockProcessorResult,
      statusCode: 200,
    });

    // Spy on utility function
    sendSuccessSpy = vi.spyOn(utils, 'sendSuccess');
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Clean up test file after each test
    await cleanupTestFile();
  });

  afterAll(async () => {
    // Try to remove the uploads directory if it's empty
    try {
      await fs.rmdir(path.dirname(testFilePath)).catch(() => {
        /* ignore errors */
      });
    } catch (error) {
      // Ignore errors during directory cleanup
    }
  });

  describe('uploadFile', () => {
    it('should process file and return successful response', async () => {
      // Call the controller method
      await fileUploadController.uploadFile(req, res, next);

      // Verify service was called
      expect(processFileAndStoreSpy).toHaveBeenCalledWith(mockFile);

      // Verify response
      expect(sendSuccessSpy).toHaveBeenCalledWith(
        res,
        mockProcessorResult,
        'File processed and data stored successfully',
      );
    });

    it('should handle error when no file is uploaded', async () => {
      // Setup request without file
      req.file = undefined;

      // Call the method
      await fileUploadController.uploadFile(req, res, next);

      // Verify next was called with FileUploadError
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('No file uploaded');

      // Verify service wasn't called
      expect(processFileAndStoreSpy).not.toHaveBeenCalled();
      expect(sendSuccessSpy).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      // Setup mock to throw error
      const errorMessage = 'Service error';
      processFileAndStoreSpy.mockRejectedValue(new Error(errorMessage));

      // Call the method with try/catch to ensure next gets called
      try {
        await fileUploadController.uploadFile(req, res, next);
      } catch (error) {
        // We don't expect to get here since asyncHandler should catch the error
        expect(true).toBe(false);
      }

      // Wait for promises to resolve
      await vi.waitFor(() => {
        // Verify next was called with the error
        expect(next).toHaveBeenCalled();
        const error = next.mock.calls[0][0];
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe(errorMessage);

        // Verify response wasn't sent
        expect(sendSuccessSpy).not.toHaveBeenCalled();
      });
    });
  });
});
