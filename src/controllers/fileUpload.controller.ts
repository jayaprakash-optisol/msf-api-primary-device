import { type Request, type Response } from 'express';

import { ParcelProcessorService } from '../services/parcelProcessor.service';
import { asyncHandler } from '../middleware/async.middleware';
import { sendSuccess, FileUploadError } from '../utils';
import { type IParcelProcessorService } from '../types';

export class FileUploadController {
  private readonly parcelProcessorService: IParcelProcessorService;

  constructor() {
    this.parcelProcessorService = ParcelProcessorService.getInstance();
  }

  uploadFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new FileUploadError('No file uploaded');
    }

    // Process the file and store the data in a single service call
    const result = await this.parcelProcessorService.processFileAndStore(req.file);

    // Return the result
    sendSuccess(res, result.data, 'File processed and data stored successfully');
  });
}
