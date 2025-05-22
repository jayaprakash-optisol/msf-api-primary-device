import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import express, { Application } from 'express';
import request from 'supertest';
import fileUploadRoutes from '../../src/routes/fileUpload.routes';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import fs from 'fs/promises';

// Create a flag to simulate missing file
let shouldSimulateMissingFile = false;
// Store created file paths for cleanup
let createdFilePaths: string[] = [];

// Mock the auth middleware
vi.mock('../../src/middleware/auth.middleware', () => ({
  authenticate: vi.fn((req, res, next) => next()),
}));

// Mock the file upload controller
vi.mock('../../src/controllers/fileUpload.controller', () => {
  return {
    FileUploadController: vi.fn().mockImplementation(() => ({
      uploadFile: vi.fn((req, res) => {
        if (!req.file) {
          return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'No file uploaded',
          });
        }
        return res.status(StatusCodes.OK).json({
          success: true,
          message: 'File processed and data stored successfully',
          data: {
            parcel: {
              purchaseOrderNumber: 'PO123',
              parcelFrom: 'Location A',
              parcelTo: 'Location B',
            },
            parcelItems: [],
          },
        });
      }),
    })),
  };
});

// Mock multer middleware
vi.mock('../../src/services/fileUpload.service', () => ({
  upload: {
    single: () => async (req: any, res: any, next: any) => {
      try {
        // Skip file creation if we're simulating missing file
        if (shouldSimulateMissingFile) {
          return next();
        }

        // Create uploads directory if it doesn't exist
        await fs.mkdir('uploads', { recursive: true });

        // Create a test file
        const filePath = path.join('uploads', `file-${Date.now()}.xlsx`);
        await fs.writeFile(filePath, 'test file content');

        // Store created file path for cleanup
        createdFilePaths.push(filePath);

        req.file = {
          fieldname: 'file',
          originalname: 'test.xlsx',
          encoding: '7bit',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          destination: 'uploads/',
          filename: path.basename(filePath),
          path: filePath,
          size: 1024,
        };
        next();
      } catch (error) {
        next(error);
      }
    },
  },
}));

// Helper function to clean up files
async function cleanupFiles() {
  for (const filePath of createdFilePaths) {
    try {
      await fs.unlink(filePath).catch(() => {
        /* ignore errors */
      });
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  createdFilePaths = [];
}

describe('File Upload Routes (Integration)', () => {
  let app: Application;
  let api: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', fileUploadRoutes);
    api = request(app);
  });

  afterAll(async () => {
    // Clean up all created files after all tests
    await cleanupFiles();

    // Try to remove the uploads directory if it's empty
    try {
      await fs.rmdir('uploads').catch(() => {
        /* ignore errors */
      });
    } catch (error) {
      // Ignore errors during directory cleanup
    }
  });

  describe('POST /api/upload', () => {
    beforeEach(() => {
      // Reset the flag before each test
      shouldSimulateMissingFile = false;
    });

    afterEach(async () => {
      // Clean up files after each test
      await cleanupFiles();
    });

    it('should upload file successfully', async () => {
      const response = await api
        .post('/api/upload')
        .attach('file', Buffer.from('test file content'), {
          filename: 'test.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        success: true,
        message: 'File processed and data stored successfully',
        data: expect.objectContaining({
          parcel: expect.objectContaining({
            purchaseOrderNumber: expect.any(String),
            parcelFrom: expect.any(String),
            parcelTo: expect.any(String),
          }),
          parcelItems: expect.any(Array),
        }),
      });
    });

    it('should handle missing file', async () => {
      // Set the flag to simulate missing file
      shouldSimulateMissingFile = true;

      const response = await api.post('/api/upload').expect(StatusCodes.BAD_REQUEST);

      expect(response.body).toEqual({
        success: false,
        message: 'No file uploaded',
      });
    });
  });
});
