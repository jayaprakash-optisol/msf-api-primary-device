export interface Parcel {
  purchaseOrderNumber: string | null;
  parcelFrom: string | null;
  parcelTo: string | null;
  packingListNumber?: string | null;
  totalNumberOfParcels?: number;
  itemType?: string;
}

export interface Product {
  productCode: string | null;
  productDescription: string | null;
}

export interface ParcelItem {
  parcelNo: string | null;
  productQuantity: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  weight: string | null;
  volume: string | null;
  product: Product;
}

export interface DbPayload {
  parcel: Parcel;
  parcelItems: ParcelItem[];
}

export interface IFileUploadService {
  processFile(file: Express.Multer.File): Promise<DbPayload[]>;
}
