import { DbPayload, ParcelProcessorResult } from '../../src/types';

// Mock file object
export const mockFile = {
  fieldname: 'file',
  originalname: 'test-file.xlsx',
  encoding: '7bit',
  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  destination: 'uploads/',
  filename: 'file-123456789.xlsx',
  path: 'uploads/file-123456789.xlsx',
  size: 12345,
  buffer: Buffer.from('test'),
} as Express.Multer.File;

// Mock XML file object
export const mockXmlFile = {
  fieldname: 'file',
  originalname: 'test-file.xml',
  encoding: '7bit',
  mimetype: 'application/xml',
  destination: 'uploads/',
  filename: 'file-123456789.xml',
  path: 'uploads/file-123456789.xml',
  size: 12345,
  buffer: Buffer.from('test'),
} as Express.Multer.File;

// Mock parcel data
export const mockParcelData: DbPayload[] = [
  {
    parcel: {
      purchaseOrderNumber: '25/CH/KE202/FO01861',
      parcelFrom: 'OCG_KE2_SKI',
      parcelTo: 'OCG_KE1_MOM',
      packingListNumber: 'PPL/02225-11',
      totalNumberOfParcels: 1,
      itemType: 'regular',
    },
    parcelItems: [
      {
        parcelNo: '1 to 1',
        productQuantity: '7.000 PCE',
        batchNumber: null,
        expiryDate: null,
        weight: '12.00',
        volume: '36.00',
        product: {
          productCode: 'PHDWPOSHW30',
          productDescription: 'POLISH wood, 300ml, for furniture, can',
        },
      },
      {
        parcelNo: '1 to 1',
        productQuantity: '8.000 PCE',
        batchNumber: null,
        expiryDate: null,
        weight: '12.00',
        volume: '36.00',
        product: {
          productCode: 'PHYGDETEG3-',
          productDescription: 'GLASS CLEANER spray for windows, 300-360ml',
        },
      },
    ],
  },
];

// Mock service response data
export const mockParcelStorageResponse = {
  success: true,
  message: 'Operation successful',
  data: { parcelId: 'mock-uuid-1' },
  statusCode: 200,
};

// Mock processor result
export const mockProcessorResult: ParcelProcessorResult = {
  parsedData: mockParcelData,
  storedParcels: [{ parcelId: 'mock-uuid-1' }],
};
