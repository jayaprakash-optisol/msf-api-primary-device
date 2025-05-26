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

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

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

  // ============================================================================
  // XLSX PROCESSING METHODS
  // ============================================================================

  /**
   * Process an XLSX file and return the parsed data
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
   */
  private _findParcelStarts(rows: ExcelRow[]): number[] {
    return rows.map((row, i) => (row[0]?.startsWith('Parcel No:') ? i : -1)).filter(i => i >= 0);
  }

  /**
   * Extract the parcel number from a row
   */
  private _extractParcelNo(row: ExcelRow): string | null {
    const raw = row[0] ?? '';
    const parts = raw.split(':');
    return parts[1]?.trim() || null;
  }

  /**
   * Build the parcel header from the uploaded file
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

    // Extract purchase order number
    const ourRow = findUp('Our Ref.:');
    const poNum = ourRow >= 0 ? toStr(rows[ourRow][2]) : null;

    // Extract packing list number
    const plRow = findUp('PACKING LIST');
    const plNum = plRow >= 0 ? toStr(rows[plRow + 1]?.[0]) : null;

    // Extract shipper/dispatch information
    const hdrRow = rows.findIndex(
      (r, i) => i <= start && r.some((c: string | null) => /shipper/i.test(c ?? '')),
    );
    const hdr = hdrRow >= 0 ? rows[hdrRow] : [];
    const vals = rows[hdrRow + 1] ?? [];
    const shipIdx = hdr.findIndex((c: string | null) => /^shipper:/i.test(c ?? ''));
    const dispIdx = hdr.findIndex((c: string | null) => /^dispatch:/i.test(c ?? ''));
    const from = shipIdx >= 0 ? toStr(vals[shipIdx]) : null;
    const to = dispIdx >= 0 ? toStr(vals[dispIdx]) : null;

    // Extract total number of parcels
    let total = 1;
    if (parcelNo) {
      const regex = /^\d+[ \t]{1,3}to[ \t]{1,3}(\d+)$/i;
      const match = regex.exec(parcelNo);
      if (match?.[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          total = num;
        }
      }
    }

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
   */
  private _buildParcelItems(
    rows: ExcelRow[],
    start: number,
    end: number,
    parcelNo: string | null,
  ): ParcelItem[] {
    const toStr = (v: string | null): string | null => (v ? v.trim() : null);

    // Extract weight/volume
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

      // Skip rows without a product code
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

  // ============================================================================
  // XML PROCESSING METHODS
  // ============================================================================

  /**
   * Process an XML file and return the parsed data
   */
  private async _processXML(fileContent: Buffer): Promise<DbPayload[]> {
    try {
      const xmlData = await parseStringPromise(fileContent.toString(), {
        explicitArray: false,
        mergeAttrs: true,
      });

      const xmlFormat = this._detectXMLFormat(xmlData);
      this._validateXMLFormat(xmlData, xmlFormat);

      if (xmlFormat === 'standard') {
        return this._processStandardXML(xmlData);
      } else {
        return this._processExcelXML(xmlData);
      }
    } catch (error) {
      if (error instanceof FileUploadError) {
        throw error;
      }
      throw new FileUploadError(
        `Error processing XML file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Detect the XML format type
   */
  private _detectXMLFormat(xmlData: any): 'standard' | 'excel' {
    if (xmlData?.data?.record) {
      return 'standard';
    } else if (xmlData?.Workbook || xmlData?.['ss:Workbook']) {
      return 'excel';
    }
    throw new FileUploadError('Unknown XML format: unable to detect format type');
  }

  /**
   * Validate XML format and required fields
   */
  private _validateXMLFormat(xmlData: any, format: 'standard' | 'excel'): void {
    if (format === 'standard') {
      this._validateStandardXML(xmlData);
    } else {
      this._validateExcelXML(xmlData);
    }
  }

  /**
   * Validate standard XML format
   */
  private _validateStandardXML(xmlData: any): void {
    if (!xmlData?.data?.record) {
      throw new FileUploadError('Invalid standard XML format: missing data.record element');
    }

    const record = xmlData.data.record;
    if (!record.field || !Array.isArray(record.field)) {
      throw new FileUploadError('Invalid standard XML format: missing or invalid field array');
    }

    const requiredFields = ['origin', 'partner_id'];
    const fieldNames = record.field.map((f: any) => f.name);

    for (const required of requiredFields) {
      if (!fieldNames.includes(required)) {
        throw new FileUploadError(`Missing required field in standard XML: ${required}`);
      }
    }
  }

  /**
   * Validate Excel XML format
   */
  private _validateExcelXML(xmlData: any): void {
    const workbook = xmlData?.Workbook || xmlData?.['ss:Workbook'];
    if (!workbook) {
      throw new FileUploadError('Invalid Excel XML format: missing Workbook element');
    }

    const worksheet = workbook.Worksheet || workbook['ss:Worksheet'];
    if (!worksheet) {
      throw new FileUploadError('Invalid Excel XML format: missing Worksheet element');
    }

    const table = worksheet.Table || worksheet['ss:Table'];
    if (!table || (!table.Row && !table['ss:Row'])) {
      throw new FileUploadError('Invalid Excel XML format: missing Table or Row elements');
    }

    const rows = Array.isArray(table.Row || table['ss:Row'])
      ? table.Row || table['ss:Row']
      : [table.Row || table['ss:Row']];
    if (rows.length < 8) {
      throw new FileUploadError('Invalid Excel XML format: insufficient rows for required data');
    }
  }

  // ============================================================================
  // STANDARD XML PROCESSING
  // ============================================================================

  /**
   * Process standard XML format (UF_cargo format)
   */
  private _processStandardXML(xmlData: any): DbPayload[] {
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
      if (Array.isArray(partnerField.field)) {
        parcelFrom =
          partnerField.field.find((f: any) => f.name === 'name')?._ ||
          partnerField.field.find((f: any) => f.name === 'name') ||
          null;
      } else {
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

    const moveLineRecord = Array.isArray(moveLines.record) ? moveLines.record : [moveLines.record];

    return moveLineRecord.map((moveRecord: any) => {
      const getFieldValue = (name: string) => {
        const field = moveRecord.field.find((f: any) => f.name === name);
        return field ? field._ || field : null;
      };

      const parcelFromNum = getFieldValue('parcel_from');
      const parcelToNum = getFieldValue('parcel_to');
      const totalNumberOfParcels = getFieldValue('parcel_qty');
      const weight = getFieldValue('total_weight');
      const volume = getFieldValue('total_volume');
      const packingListNumber = getFieldValue('packing_list');

      const parcel: Parcel = {
        purchaseOrderNumber,
        parcelFrom: parcelFromNum,
        parcelTo: parcelToNum,
        packingListNumber,
        totalNumberOfParcels: totalNumberOfParcels ? parseInt(totalNumberOfParcels, 10) : 1,
        itemType: 'regular',
      };

      const parcelItems = this._processStandardXMLItems(
        moveRecord,
        weight,
        volume,
        parcelFromNum,
        parcelToNum,
      );

      return { parcel, parcelItems };
    });
  }

  /**
   * Process items from standard XML format
   */
  private _processStandardXMLItems(
    moveRecord: any,
    weight: string | null,
    volume: string | null,
    parcelFromNum: string | null,
    parcelToNum: string | null,
  ): ParcelItem[] {
    const parcelItems: ParcelItem[] = [];
    const productRecords = moveRecord.record;

    if (!productRecords) return parcelItems;

    const records = Array.isArray(productRecords) ? productRecords : [productRecords];

    records.forEach((productRecord: any) => {
      if (!productRecord.field) return;

      const getProductFieldValue = (name: string) => {
        const field = productRecord.field.find((f: any) => f.name === name);
        return field ? field._ || field : null;
      };

      // Extract product information
      const { productCode, productDescription } = this._extractProductInfo(productRecord);
      if (!productCode) return;

      // Extract quantity and unit
      const quantity = getProductFieldValue('product_qty');
      const unit = this._extractUnitOfMeasure(productRecord);
      const productQuantity = quantity && unit ? `${quantity} ${unit}` : quantity;

      // Extract batch and expiry
      const batchNumber = getProductFieldValue('prodlot_id');
      const expiryDate = getProductFieldValue('expired_date');

      const product: Product = {
        productCode,
        productDescription,
      };

      parcelItems.push({
        parcelNo: `${parcelFromNum} to ${parcelToNum}`,
        productQuantity,
        batchNumber,
        expiryDate,
        weight,
        volume,
        product,
      });
    });

    return parcelItems;
  }

  /**
   * Extract product information from standard XML
   */
  private _extractProductInfo(productRecord: any): {
    productCode: string | null;
    productDescription: string | null;
  } {
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
        productCode =
          productField.field.field.find((f: any) => f.name === 'product_code')?._ ||
          productField.field.field.find((f: any) => f.name === 'product_code') ||
          null;
        productDescription =
          productField.field.field.find((f: any) => f.name === 'product_name')?._ ||
          productField.field.field.find((f: any) => f.name === 'product_name') ||
          null;
      } else {
        productCode = productField.field.product_code || null;
        productDescription = productField.field.product_name || null;
      }
    }

    return { productCode, productDescription };
  }

  /**
   * Extract unit of measure from standard XML
   */
  private _extractUnitOfMeasure(productRecord: any): string | null {
    const uomField = productRecord.field.find((f: any) => f.name === 'product_uom');
    if (uomField && uomField.field) {
      if (Array.isArray(uomField.field)) {
        return (
          uomField.field.find((f: any) => f.name === 'name')?._ ||
          uomField.field.find((f: any) => f.name === 'name') ||
          null
        );
      } else {
        return uomField.field._ || uomField.field.name || null;
      }
    }
    return null;
  }

  // ============================================================================
  // EXCEL XML PROCESSING
  // ============================================================================

  /**
   * Process Excel XML format (61320_incoming format)
   */
  private _processExcelXML(xmlData: any): DbPayload[] {
    const workbook = xmlData.Workbook || xmlData['ss:Workbook'];
    const worksheet = workbook.Worksheet || workbook['ss:Worksheet'];
    const table = worksheet.Table || worksheet['ss:Table'];
    const rows = Array.isArray(table.Row || table['ss:Row'])
      ? table.Row || table['ss:Row']
      : [table.Row || table['ss:Row']];

    const origin = this._getHeaderValue(rows, 2, 1);
    return this._processExcelXMLRows(rows, origin);
  }

  /**
   * Process rows from Excel XML and build parcels
   */
  private _processExcelXMLRows(rows: any[], origin: string | null): DbPayload[] {
    const result: DbPayload[] = [];
    let currentParcel: Partial<Parcel> = {};
    let currentParcelItems: ParcelItem[] = [];

    for (const row of rows) {
      if (!row || (!row.Cell && !row['ss:Cell'])) continue;

      const cells = Array.isArray(row.Cell || row['ss:Cell'])
        ? row.Cell || row['ss:Cell']
        : [row.Cell || row['ss:Cell']];

      const processed = this._processExcelXMLRow(
        cells,
        currentParcel,
        currentParcelItems,
        origin,
        result,
      );
      currentParcel = processed.currentParcel;
      currentParcelItems = processed.currentParcelItems;
    }

    this._addFinalParcel(result, currentParcel, currentParcelItems);
    return result;
  }

  /**
   * Process a single Excel XML row
   */
  private _processExcelXMLRow(
    cells: any[],
    currentParcel: Partial<Parcel>,
    currentParcelItems: ParcelItem[],
    origin: string | null,
    result: DbPayload[],
  ): { currentParcel: Partial<Parcel>; currentParcelItems: ParcelItem[] } {
    const firstCellData = cells[0]?.Data || cells[0]?.['ss:Data'];
    const firstCell = firstCellData?._ || firstCellData || '';

    if (firstCell === '#') {
      this._addFinalParcel(result, currentParcel, currentParcelItems);
      return {
        currentParcel: this._buildExcelXMLParcel(cells, origin),
        currentParcelItems: [],
      };
    } else if (firstCell && /^\d+$/.test(firstCell)) {
      const parcelItem = this._buildExcelXMLParcelItem(cells, currentParcel);
      if (parcelItem) {
        currentParcelItems.push(parcelItem);
      }
    }

    return { currentParcel, currentParcelItems };
  }

  /**
   * Add final parcel to result if it exists
   */
  private _addFinalParcel(
    result: DbPayload[],
    currentParcel: Partial<Parcel>,
    currentParcelItems: ParcelItem[],
  ): void {
    if (currentParcel.purchaseOrderNumber) {
      result.push({
        parcel: currentParcel as Parcel,
        parcelItems: currentParcelItems,
      });
    }
  }

  /**
   * Get header value from Excel XML rows
   */
  private _getHeaderValue(rows: any[], rowIndex: number, cellIndex: number = 1): string | null {
    const row = rows[rowIndex];
    if (!row || (!row.Cell && !row['ss:Cell'])) return null;
    const cells = Array.isArray(row.Cell || row['ss:Cell'])
      ? row.Cell || row['ss:Cell']
      : [row.Cell || row['ss:Cell']];
    const cell = cells[cellIndex];
    const data = cell?.Data || cell?.['ss:Data'];
    return this._extractStringValue(data);
  }

  /**
   * Build parcel object from Excel XML cells
   */
  private _buildExcelXMLParcel(cells: any[], origin: string | null): Partial<Parcel> {
    const parcelQtyData = cells[1]?.Data || cells[1]?.['ss:Data'];
    const parcelQty = this._extractStringValue(parcelQtyData) || '1';
    const parcelFromData = cells[2]?.Data || cells[2]?.['ss:Data'];
    const parcelFrom = this._extractStringValue(parcelFromData) || '1';
    const parcelToData = cells[3]?.Data || cells[3]?.['ss:Data'];
    const parcelTo = this._extractStringValue(parcelToData) || '1';
    const packingListData = cells[9]?.Data || cells[9]?.['ss:Data'];
    const packingList = this._extractStringValue(packingListData);

    return {
      purchaseOrderNumber: origin,
      parcelFrom: parcelFrom,
      parcelTo: parcelTo,
      packingListNumber: packingList,
      totalNumberOfParcels: parseInt(parcelQty, 10) || 1,
      itemType: 'regular',
    };
  }

  /**
   * Build parcel item from Excel XML cells
   */
  private _buildExcelXMLParcelItem(
    cells: any[],
    currentParcel: Partial<Parcel>,
  ): ParcelItem | null {
    const productCodeData = cells[2]?.Data || cells[2]?.['ss:Data'];
    const productCode = this._extractStringValue(productCodeData);

    if (!productCode) return null;

    const productDescriptionData = cells[3]?.Data || cells[3]?.['ss:Data'];
    const productDescription = this._extractStringValue(productDescriptionData);
    const quantityData = cells[4]?.Data || cells[4]?.['ss:Data'];
    const quantity = this._extractStringValue(quantityData);
    const uomData = cells[5]?.Data || cells[5]?.['ss:Data'];
    const uom = this._extractStringValue(uomData);
    const batchData = cells[8]?.Data || cells[8]?.['ss:Data'];
    const batch = this._extractStringValue(batchData);
    const expiryDateData = cells[9]?.Data || cells[9]?.['ss:Data'];
    const expiryDate = this._extractStringValue(expiryDateData);

    const product: Product = {
      productCode,
      productDescription,
    };

    const productQuantity = quantity && uom ? `${quantity} ${uom}` : quantity;

    return {
      parcelNo: `${currentParcel.parcelFrom} to ${currentParcel.parcelTo}`,
      productQuantity,
      batchNumber: batch,
      expiryDate,
      weight: null,
      volume: null,
      product,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Extract string value from XML data, handling both string and object cases
   */
  private _extractStringValue(data: any): string | null {
    if (!data) return null;

    if (typeof data === 'string') {
      return data.trim() || null;
    }

    if (typeof data === 'object') {
      if (data._ !== undefined) {
        return typeof data._ === 'string' ? data._.trim() || null : null;
      }

      if (typeof data === 'object' && data !== null) {
        const keys = Object.keys(data);
        if (keys.length === 0 || (keys.length === 1 && keys[0].includes('Type'))) {
          return null;
        }
      }
    }

    return null;
  }
}
