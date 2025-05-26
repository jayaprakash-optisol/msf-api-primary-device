import multer from 'multer';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { FileUploadError } from '../utils';
import { DbPayload, IFileUploadService } from '../types';
import { XMLProcessor } from '../utils/xmlProcessor.util';
import { ExcelProcessor } from '../utils/excelProcessor.util';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
];

// Ensure uploads directory exists
const UPLOAD_DIR = 'uploads/';
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter to only allow XML and XLSX files
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new FileUploadError('Only XML and XLSX files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export class FileUploadService implements IFileUploadService {
  private static instance: FileUploadService;

  private constructor() {}

  public static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  /**
   * Process an uploaded file and return the parsed data
   * @param file - The uploaded file
   * @returns An array of DbPayload objects containing parcel and parcelItem data
   * @throws FileUploadError if the file format is invalid or the file type is unsupported
   */
  async processFile(file: Express.Multer.File): Promise<DbPayload[]> {
    try {
      const fileContent = await fs.promises.readFile(file.path);

      // Process based on file type
      if (file.mimetype.includes('spreadsheetml')) {
        return await ExcelProcessor.processXLSX(fileContent);
      } else if (file.mimetype.includes('xml')) {
        return await XMLProcessor.processXML(fileContent);
      }

      throw new FileUploadError('Unsupported file type');
    } catch (error) {
      if (error instanceof FileUploadError) {
        throw error;
      }
      throw new FileUploadError(
        `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      // Clean up the uploaded file
      await fs.promises.unlink(file.path).catch(console.error);
    }
  }
}
