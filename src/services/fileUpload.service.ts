import multer from 'multer';
import { Request } from 'express';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { parseStringPromise } from 'xml2js';

import { FileUploadError } from '../utils';
import { DbPayload, IFileUploadService, Parcel, ParcelItem, Product } from '../types';

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
    // Ensure directory exists before storing file
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

// Define Excel row type for internal use
type ExcelRow = Array<string | null>;

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
        return await this._processXLSX(fileContent);
      } else if (file.mimetype.includes('xml')) {
        return await this._processXML(fileContent);
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

  /**
   * Process an XLSX file and return the parsed data
   * @param fileContent - The content of the uploaded file
   * @returns An array of DbPayload objects containing parcel and parcelItem data
   * @throws FileUploadError if the file format is invalid
   */
  private async _processXLSX(fileContent: Buffer): Promise<DbPayload[]> {
    const wb = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
      header: 1,
      raw: false,
      defval: null,
      dateNF: 'yyyy-mm-dd',
      blankrows: false,
    });

    this._validateXlsxFormat(rows);

    const starts = this._findParcelStarts(rows);

    if (starts.length === 0) {
      return [
        {
          parcel: {
            purchaseOrderNumber: null,
            parcelFrom: null,
            parcelTo: null,
          },
          parcelItems: [],
        },
      ];
    }

    // Process each parcel and create a separate DbPayload for each
    return starts.map((start, idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1] : rows.length;
      const parcelNo = this._extractParcelNo(rows[start]);
      const parcel = this._buildParcelHeader(rows, start, end, parcelNo);
      const parcelItems = this._buildParcelItems(rows, start, end, parcelNo);
      return { parcel, parcelItems };
    });
  }

  /**
   * Validate the format of an XLSX file
   * @param rows - The rows of the uploaded file
   * @throws FileUploadError if the file format is invalid
   */
  private _validateXlsxFormat(rows: ExcelRow[]): void {
    const hasParcel = rows.some(r => r[0]?.toString().startsWith('Parcel No:'));
    const hasOurRef = rows.some(r => r[0]?.toString().startsWith('Our Ref.:'));
    const hasPack = rows.some(r => r[0]?.toString().startsWith('PACKING LIST'));
    if (!hasParcel || !hasOurRef || !hasPack) {
      throw new FileUploadError(
        'Invalid XLSX format: expected Parcel No, Our Ref.: and PACKING LIST headers',
      );
    }
    // Check item header row
    const hdrRow = rows.find(
      r =>
        Array.isArray(r) &&
        r.includes('Code') &&
        r.includes('Description') &&
        r.includes('Total Qty.'),
    );
    if (!hdrRow) {
      throw new FileUploadError(
        'Invalid XLSX format: missing item columns Code, Description, Total Qty.',
      );
    }
  }

  /**
   * Find the starting indices of parcels in the uploaded file
   * @param rows - The rows of the uploaded file
   * @returns An array of indices where parcel headers start
   */
  private _findParcelStarts(rows: ExcelRow[]): number[] {
    return rows.map((row, i) => (row[0]?.startsWith('Parcel No:') ? i : -1)).filter(i => i >= 0);
  }

  /**
   * Extract the parcel number from a row
   * @param row - The row to extract the parcel number from
   * @returns The parcel number or null if not found
   */
  private _extractParcelNo(row: ExcelRow): string | null {
    const raw = row[0] ?? '';
    const parts = raw.split(':');
    return parts[1]?.trim() || null;
  }

  /**
   * Build the parcel header from the uploaded file
   * @param rows - The rows of the uploaded file
   * @param start - The starting index of the parcel
   * @param end - The ending index of the parcel
   * @param parcelNo - The parcel number
   * @returns A Parcel object containing the parcel header data
   */
  private _buildParcelHeader(
    rows: ExcelRow[],
    start: number,
    end: number,
    parcelNo: string | null,
  ): Parcel {
    const toStr = (v: string | null): string | null => (v ? v.trim() : null);

    const findUp = (label: string): number => {
      for (let r = start; r >= 0; r--) {
        if (rows[r][0]?.startsWith(label)) return r;
      }
      return -1;
    };

    const ourRow = findUp('Our Ref.:');
    const poNum = ourRow >= 0 ? toStr(rows[ourRow][2]) : null;

    const plRow = findUp('PACKING LIST');
    const plNum = plRow >= 0 ? toStr(rows[plRow + 1]?.[0]) : null;

    // Shipper/Dispatch
    const hdrRow = rows.findIndex(
      (r, i) => i <= start && r.some((c: string | null) => /shipper/i.test(c ?? '')),
    );
    const hdr = hdrRow >= 0 ? rows[hdrRow] : [];
    const vals = rows[hdrRow + 1] ?? [];
    const shipIdx = hdr.findIndex((c: string | null) => /^shipper:/i.test(c ?? ''));
    const dispIdx = hdr.findIndex((c: string | null) => /^dispatch:/i.test(c ?? ''));
    const from = shipIdx >= 0 ? toStr(vals[shipIdx]) : null;
    const to = dispIdx >= 0 ? toStr(vals[dispIdx]) : null;

    // Extract total number of parcels from parcelNo (e.g., "2 to 2" -> 2)
    let total = 1;
    if (parcelNo) {
      // Use a more efficient regex with bounded repetition to prevent ReDoS
      const regex = /^\d+[ \t]{1,3}to[ \t]{1,3}(\d+)$/i;
      const match = regex.exec(parcelNo);
      if (match?.[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          total = num;
        }
      }
    }

    // item type
    const itemType = this._detectItemType(rows, start, end);

    return {
      purchaseOrderNumber: poNum,
      parcelFrom: from,
      parcelTo: to,
      packingListNumber: plNum,
      totalNumberOfParcels: total,
      itemType,
    };
  }

  /**
   * Build the parcel items from the uploaded file
   * @param rows - The rows of the uploaded file
   * @param start - The starting index of the parcel
   * @param end - The ending index of the parcel
   * @param parcelNo - The parcel number
   * @returns An array of ParcelItem objects containing the parcel item data
   */
  private _buildParcelItems(
    rows: ExcelRow[],
    start: number,
    end: number,
    parcelNo: string | null,
  ): ParcelItem[] {
    const toStr = (v: string | null): string | null => (v ? v.trim() : null);

    // weight/volume
    const info = toStr(rows[start][3]);
    const weight = info?.match(/Total weight\s*([\d.]+)/i)?.[1] ?? null;
    const volume = info?.match(/Total volume\s*([\d.]+)/i)?.[1] ?? null;

    const hdr = rows[start + 1].map((v: string | null) => toStr(v));
    const idxOf = (label: string) => hdr.findIndex((h: string | null) => h === label);

    const items: ParcelItem[] = [];
    for (let r = start + 2; r < end; r++) {
      const row = rows[r];
      if (!row[0]) break;

      const productCode = toStr(row[idxOf('Code')]);
      const productDescription = toStr(row[idxOf('Description')]);

      // Skip rows without a product code to avoid duplicate empty entries
      if (!productCode) continue;

      const product: Product = {
        productCode,
        productDescription,
      };

      items.push({
        parcelNo,
        productQuantity: toStr(row[idxOf('Total Qty.')]),
        batchNumber: toStr(row[idxOf('Batch')]),
        expiryDate: toStr(row[idxOf('Exp. Date')]),
        weight,
        volume,
        product,
      });
    }
    return items;
  }

  /**
   * Detect the item type of a parcel
   * @param rows - The rows of the uploaded file
   * @param start - The starting index of the parcel
   * @param end - The ending index of the parcel
   * @returns The item type of the parcel
   */
  private _detectItemType(rows: ExcelRow[], start: number, end: number): Parcel['itemType'] {
    const toStr = (v: string | null): string | null => v?.trim()?.toLowerCase() ?? null;

    let type: Parcel['itemType'] = 'regular';
    for (let r = start; r < end; r++) {
      const row = rows[r];
      if (row.some((c: string | null) => /Containing:?/i.test(c ?? ''))) {
        const labels = rows[r + 1] ?? [];
        const vals = rows[r + 2] ?? [];
        labels.forEach((cell: string | null, idx: number) => {
          const lbl = toStr(cell);
          const val = toStr(vals[idx]);
          if (val === 'x' && lbl && ['cc', 'dg', 'cs'].includes(lbl)) {
            type = lbl as Parcel['itemType'];
          }
        });
        break;
      }
    }
    return type;
  }

  /**
   * Process an XML file and return the parsed data
   * @param fileContent - The content of the uploaded file
   * @returns An array of DbPayload objects containing parcel and parcelItem data
   * @throws FileUploadError if the file format is invalid
   */
  private async _processXML(fileContent: Buffer): Promise<DbPayload[]> {
    try {
      // Parse XML to JS object
      const xmlData = await parseStringPromise(fileContent.toString(), {
        explicitArray: false,
        mergeAttrs: true,
      });

      // Validate XML structure
      if (!xmlData?.data?.record) {
        throw new FileUploadError('Invalid XML format: missing required elements');
      }

      const record = xmlData.data.record;

      // Extract purchase order number
      const purchaseOrderNumber =
        record.field.find((f: any) => f.name === 'origin')?._ ||
        record.field.find((f: any) => f.name === 'origin') ||
        null;

      // Extract partner name (parcel from)
      let parcelFrom = null;
      const partnerField = record.field.find((f: any) => f.name === 'partner_id');
      if (partnerField && partnerField.field) {
        // Handle both array and object cases for partnerField.field
        if (Array.isArray(partnerField.field)) {
          parcelFrom =
            partnerField.field.find((f: any) => f.name === 'name')?._ ||
            partnerField.field.find((f: any) => f.name === 'name') ||
            null;
        } else {
          // Handle case where field is an object
          parcelFrom = partnerField.field._ || partnerField.field.name || null;
        }
      }

      // Extract move lines
      const moveLines = record.field.find((f: any) => f.name === 'move_lines');
      if (!moveLines || !moveLines.record) {
        return [
          {
            parcel: {
              purchaseOrderNumber,
              parcelFrom,
              parcelTo: null,
            },
            parcelItems: [],
          },
        ];
      }

      // Process each move line (parcel)
      const moveLineRecord = Array.isArray(moveLines.record)
        ? moveLines.record
        : [moveLines.record];

      return moveLineRecord.map((moveRecord: any) => {
        // Extract parcel information
        const getFieldValue = (name: string) => {
          const field = moveRecord.field.find((f: any) => f.name === name);
          return field ? field._ || field : null;
        };

        const parcelFrom = getFieldValue('parcel_from');
        const parcelTo = getFieldValue('parcel_to');
        const totalNumberOfParcels = getFieldValue('parcel_qty');
        const weight = getFieldValue('total_weight');
        const volume = getFieldValue('total_volume');
        const packingListNumber = getFieldValue('packing_list');

        // Build parcel object
        const parcel: Parcel = {
          purchaseOrderNumber,
          parcelFrom,
          parcelTo,
          packingListNumber,
          totalNumberOfParcels: totalNumberOfParcels ? parseInt(totalNumberOfParcels, 10) : 1,
          itemType: 'regular', // Default value
        };

        // Process parcel items
        const parcelItems: ParcelItem[] = [];

        // Handle nested records (product items)
        const productRecords = moveRecord.record;
        if (productRecords) {
          const records = Array.isArray(productRecords) ? productRecords : [productRecords];

          records.forEach((productRecord: any) => {
            // Skip if not a product record
            if (!productRecord.field) return;

            const getProductFieldValue = (name: string) => {
              const field = productRecord.field.find((f: any) => f.name === name);
              return field ? field._ || field : null;
            };

            // Extract product information
            let productCode = null;
            let productDescription = null;

            const productField = productRecord.field.find((f: any) => f.name === 'product_id');
            if (productField && productField.field) {
              if (Array.isArray(productField.field)) {
                productCode =
                  productField.field.find((f: any) => f.name === 'product_code')?._ ||
                  productField.field.find((f: any) => f.name === 'product_code') ||
                  null;
                productDescription =
                  productField.field.find((f: any) => f.name === 'product_name')?._ ||
                  productField.field.find((f: any) => f.name === 'product_name') ||
                  null;
              } else if (Array.isArray(productField.field.field)) {
                // Handle nested field array
                productCode =
                  productField.field.field.find((f: any) => f.name === 'product_code')?._ ||
                  productField.field.field.find((f: any) => f.name === 'product_code') ||
                  null;
                productDescription =
                  productField.field.field.find((f: any) => f.name === 'product_name')?._ ||
                  productField.field.field.find((f: any) => f.name === 'product_name') ||
                  null;
              } else {
                // Handle case where field is an object
                productCode = productField.field.product_code || null;
                productDescription = productField.field.product_name || null;
              }
            }

            // Skip if no product code
            if (!productCode) return;

            // Extract quantity and unit
            const quantity = getProductFieldValue('product_qty');
            let unit = null;

            const uomField = productRecord.field.find((f: any) => f.name === 'product_uom');
            if (uomField && uomField.field) {
              if (Array.isArray(uomField.field)) {
                unit =
                  uomField.field.find((f: any) => f.name === 'name')?._ ||
                  uomField.field.find((f: any) => f.name === 'name') ||
                  null;
              } else {
                // Handle case where field is an object
                unit = uomField.field._ || uomField.field.name || null;
              }
            }

            // Format quantity with unit
            const productQuantity = quantity && unit ? `${quantity} ${unit}` : quantity;

            // Extract batch number and expiry date
            const batchNumber = getProductFieldValue('prodlot_id');
            const expiryDate = getProductFieldValue('expired_date');

            // Create product object
            const product: Product = {
              productCode,
              productDescription,
            };

            // Create parcel item
            parcelItems.push({
              parcelNo: `${parcelFrom} to ${parcelTo}`,
              productQuantity,
              batchNumber,
              expiryDate,
              weight,
              volume,
              product,
            });
          });
        }

        return { parcel, parcelItems };
      });
    } catch (error) {
      if (error instanceof FileUploadError) {
        throw error;
      }
      throw new FileUploadError(
        `Error processing XML file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
