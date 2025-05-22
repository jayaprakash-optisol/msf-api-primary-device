import { DbPayload } from './fileUpload.interface';
import { ServiceResponse } from './common.interface';

/**
 * Response type for the parcel processor service
 */
export interface ParcelProcessorResult {
  parsedData: DbPayload[];
  storedParcels: { parcelId: string }[];
}

/**
 * Service interface for processing parcels from file upload to database storage
 */
export interface IParcelProcessorService {
  /**
   * Process a file and store the extracted data in the database
   * @param file - The uploaded file
   * @returns A service response containing the processed data and parcel IDs
   */
  processFileAndStore(file: Express.Multer.File): Promise<ServiceResponse<ParcelProcessorResult>>;
}
