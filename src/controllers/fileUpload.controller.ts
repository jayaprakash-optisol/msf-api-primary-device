import { type Request, type Response } from 'express';

import { FileUploadService } from '../services/fileUploadService';
import { asyncHandler } from '../middleware/async.middleware';
import { sendSuccess, FileUploadError } from '../utils';
import { type IFileUploadService } from '../types';

export class FileUploadController {
  private readonly fileUploadService: IFileUploadService;

  constructor() {
    this.fileUploadService = FileUploadService.getInstance();
  }

  uploadFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new FileUploadError('No file uploaded');
    }

    const processedData = await this.fileUploadService.processFile(req.file);
    sendSuccess(res, processedData, 'File processed successfully');
  });
}
