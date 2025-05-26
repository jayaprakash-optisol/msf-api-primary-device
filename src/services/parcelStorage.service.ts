import { eq } from 'drizzle-orm';
import { db } from '../config/database.config';
import { parcels, parcelItems, products } from '../models';
import {
  type DbPayload,
  type ServiceResponse,
  ParcelInsert,
  type IParcelStorageService,
  ProductInsert,
  ParcelItemInsert,
} from '../types';
import { _ok, handleServiceError } from '../utils';

/**
 * Service to handle storing parsed Excel data into the database
 */
export class ParcelStorageService implements IParcelStorageService {
  private static instance: ParcelStorageService;

  private constructor() {}

  public static getInstance(): ParcelStorageService {
    if (!ParcelStorageService.instance) {
      ParcelStorageService.instance = new ParcelStorageService();
    }
    return ParcelStorageService.instance;
  }

  /**
   * Store parsed Excel data into the database
   * @param data - The parsed Excel data to store
   * @returns A service response containing the ID of the created parcel
   */
  async storeExcelData(data: DbPayload): Promise<ServiceResponse<{ parcelId: string }>> {
    try {
      return await db.transaction(async tx => {
        // 1. First, store the parcel
        const [insertedParcel] = await this._createParcel(tx, data);

        // 2. Process each product and parcel item
        await this._createParcelItems(tx, data.parcelItems, insertedParcel.id);

        return _ok({ parcelId: insertedParcel.id });
      });
    } catch (error) {
      throw handleServiceError(error, 'Failed to store Excel data');
    }
  }

  /**
   * Create a parcel record in the database
   * @param tx - The database transaction
   * @param data - The parsed Excel data
   * @returns The created parcel ID
   */
  private async _createParcel(tx: any, data: DbPayload) {
    const { parcel, parcelItems: items } = data;
    const parcelData: ParcelInsert = {
      purchaseOrderNumber: parcel.purchaseOrderNumber,
      totalNumberOfParcels: parcel.totalNumberOfParcels ?? 1,
      packingListNumber: parcel.packingListNumber ?? null,
      // Convert to string for decimal fields
      totalWeight: items[0]?.weight ?? null,
      totalVolume: items[0]?.volume ?? null,
      sourceSystem: 'FILE_UPLOAD',
    };

    return tx.insert(parcels).values(parcelData).returning({ id: parcels.id });
  }

  /**
   * Create or find products and create parcel items
   * @param tx - The database transaction
   * @param items - The parcel items to create
   * @param parcelId - The parent parcel ID
   */
  private async _createParcelItems(tx: any, items: DbPayload['parcelItems'], parcelId: string) {
    for (const item of items) {
      // Skip items without product code
      if (!item.product.productCode) continue;

      // Get or create the product
      const productId = await this._getOrCreateProduct(tx, item.product);

      // Create the parcel item
      await this._createParcelItem(tx, item, parcelId, productId);
    }
  }

  /**
   * Get existing product or create a new one
   * @param tx - The database transaction
   * @param product - The product data
   * @returns The product ID
   */
  private async _getOrCreateProduct(tx: any, product: DbPayload['parcelItems'][0]['product']) {
    // Make sure productCode is not null
    const productCode = product.productCode ?? '';

    // Check if product already exists
    const existingProducts = await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.productCode, productCode))
      .limit(1);

    if (existingProducts.length > 0) {
      return existingProducts[0].id;
    }

    // Create new product
    const productData: ProductInsert = {
      productCode,
      productDescription: product.productDescription,
      sourceSystem: 'FILE_UPLOAD',
    };

    const [newProduct] = await tx
      .insert(products)
      .values(productData)
      .returning({ id: products.id });

    return newProduct.id;
  }

  /**
   * Create a parcel item record
   * @param tx - The database transaction
   * @param item - The parcel item data
   * @param parcelId - The parent parcel ID
   * @param productId - The associated product ID
   */
  private async _createParcelItem(
    tx: any,
    item: DbPayload['parcelItems'][0],
    parcelId: string,
    productId: string,
  ) {
    // Parse quantity value
    const quantity = this._parseQuantity(item.productQuantity);

    // Get unit of measure
    const unitOfMeasure = item.productQuantity?.split(' ')[1] ?? null;

    // Parse expiry date safely
    const expiryDate = this._parseExpiryDate(item.expiryDate);

    // Create parcel item
    const parcelItemData: ParcelItemInsert = {
      productId,
      parcelId,
      productQuantity: quantity,
      productCode: item.product.productCode ?? '',
      expiryDate,
      batchNumber: item.batchNumber,
      weight: item.weight ?? null,
      volume: item.volume ?? null,
      unitOfMeasure,
      sourceSystem: 'FILE_UPLOAD',
    };

    await tx.insert(parcelItems).values(parcelItemData);
  }

  /**
   * Parse quantity string to number
   * @param quantityStr - The quantity string (e.g., "7.000 PCE")
   * @returns The parsed quantity as a number or null
   */
  private _parseQuantity(quantityStr: string | null): number | null {
    if (!quantityStr) return null;

    const quantityMatch = /^([\d.]+)/.exec(quantityStr);
    return quantityMatch?.[1] ? parseFloat(quantityMatch[1]) : null;
  }

  /**
   * Parse expiry date string to Date object safely
   * @param expiryDateStr - The expiry date string or object
   * @returns The parsed Date object or null if invalid
   */
  private _parseExpiryDate(expiryDateStr: string | null | any): Date | null {
    if (!expiryDateStr) return null;

    // If it's not a string, try to extract string value
    let dateString: string;
    if (typeof expiryDateStr === 'string') {
      dateString = expiryDateStr.trim();
    } else if (typeof expiryDateStr === 'object' && expiryDateStr._) {
      dateString = expiryDateStr._.trim();
    } else {
      return null;
    }

    if (!dateString) return null;

    try {
      const parsedDate = new Date(dateString);

      // Check if the date is valid
      if (isNaN(parsedDate.getTime())) {
        console.warn(`Invalid expiry date format: ${dateString}`);
        return null;
      }

      return parsedDate;
    } catch (error) {
      console.warn(`Error parsing expiry date: ${dateString}`, error);
      return null;
    }
  }
}
