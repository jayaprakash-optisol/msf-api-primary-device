import {
  type ServiceResponse,
  type IParcelProcessorService,
  type ParcelProcessorResult,
} from '../types';
import { _ok, handleServiceError, FileUploadError } from '../utils';
import { FileUploadService } from './fileUpload.service';
import { ParcelStorageService } from './parcelStorage.service';

/**
 * Service to handle the entire workflow of processing files and storing data
 */
export class ParcelProcessorService implements IParcelProcessorService {
  private static instance: ParcelProcessorService;
  private readonly fileUploadService: FileUploadService;
  private readonly parcelStorageService: ParcelStorageService;

  private constructor() {
    this.fileUploadService = FileUploadService.getInstance();
    this.parcelStorageService = ParcelStorageService.getInstance();
  }

  public static getInstance(): ParcelProcessorService {
    if (!ParcelProcessorService.instance) {
      ParcelProcessorService.instance = new ParcelProcessorService();
    }
    return ParcelProcessorService.instance;
  }

  /**
   * Process a file and store the extracted data in the database
   * @param file - The uploaded file
   * @returns A service response containing the processed data and parcel IDs
   */
  async processFileAndStore(
    file: Express.Multer.File,
  ): Promise<ServiceResponse<ParcelProcessorResult>> {
    try {
      if (!file) {
        throw new FileUploadError('No file uploaded');
      }

      // 1. Process the file to extract data
      const processedData = await this.fileUploadService.processFile(file);

      // 2. Store each parcel in the database
      const results = await Promise.all(
        processedData.map(data => this.parcelStorageService.storeExcelData(data)),
      );

      // 3. Return both the parsed data and the storage results
      return _ok({
        parsedData: processedData,
        storedParcels: results.map(result => result.data) as { parcelId: string }[],
      });
    } catch (error) {
      throw handleServiceError(error, 'Failed to process file and store data');
    }
  }
}
