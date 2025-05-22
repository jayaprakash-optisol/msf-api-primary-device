import { type Request, type Response } from 'express';

import { FileUploadService } from '../services/fileUpload.service';
import { ParcelStorageService } from '../services/parcelStorage.service';
import { asyncHandler } from '../middleware/async.middleware';
import { sendSuccess, FileUploadError } from '../utils';
import { type IFileUploadService, type ServiceResponse } from '../types';
import { type IParcelStorageService } from '../types/parcelStorage.interface';

export class FileUploadController {
  private readonly fileUploadService: IFileUploadService;
  private readonly parcelStorageService: IParcelStorageService;

  constructor() {
    this.fileUploadService = FileUploadService.getInstance();
    this.parcelStorageService = ParcelStorageService.getInstance();
  }

  uploadFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new FileUploadError('No file uploaded');
    }

    // Process the file to extract data
    const processedData = await this.fileUploadService.processFile(req.file);

    // Store each parcel in the database
    const results = await Promise.all(
      processedData.map(data => this.parcelStorageService.storeExcelData(data)),
    );

    // Return both the parsed data and the storage results
    sendSuccess(
      res,
      {
        parsedData: processedData,
        storedParcels: results.map((result: ServiceResponse<{ parcelId: string }>) => result.data),
      },
      'File processed and data stored successfully',
    );
  });
}
