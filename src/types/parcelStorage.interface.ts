import { DbPayload } from './fileUpload.interface';
import { ServiceResponse } from './common.interface';
import { parcelItems, parcels, products } from '../models';

// Define insert types for each table
export type ParcelInsert = typeof parcels.$inferInsert;
export type ProductInsert = typeof products.$inferInsert;
export type ParcelItemInsert = typeof parcelItems.$inferInsert;

/**
 * Service to handle storing parsed Excel data into the database
 */
export interface IParcelStorageService {
  /**
   * Store parsed Excel data into the database
   * @param data - The parsed Excel data to store
   * @returns A service response containing the ID of the created parcel
   */
  storeExcelData(data: DbPayload): Promise<ServiceResponse<{ parcelId: string }>>;
}
