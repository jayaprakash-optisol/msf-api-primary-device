import multer from 'multer';
import { Request } from 'express';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';

import { FileUploadError } from '../utils/error.util';
import { DbPayload, Parcel, ParcelItem, Product, IFileUploadService } from '../types';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/xml',
  'text/xml',
];

// Configure multer storage
const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    cb(null, 'uploads/');
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
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

  async processFile(file: Express.Multer.File): Promise<DbPayload[]> {
    try {
      const fileContent = await fs.readFile(file.path);

      // For now, only XLSX processing is implemented
      if (file.mimetype.includes('spreadsheetml')) {
        return await this.processXLSX(fileContent);
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
      await fs.unlink(file.path).catch(console.error);
    }
  }

  private async processXLSX(fileContent: Buffer): Promise<DbPayload[]> {
    const wb = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
      header: 1,
      raw: false,
      defval: null,
      dateNF: 'yyyy-mm-dd',
      blankrows: false,
    });

    const starts = this.findParcelStarts(rows);

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
      const parcelNo = this.extractParcelNo(rows[start]);
      const parcel = this.buildParcelHeader(rows, start, end, parcelNo);
      const parcelItems = this.buildParcelItems(rows, start, end, parcelNo);
      return { parcel, parcelItems };
    });
  }

  private findParcelStarts(rows: ExcelRow[]): number[] {
    return rows.map((row, i) => (row[0]?.startsWith('Parcel No:') ? i : -1)).filter(i => i >= 0);
  }

  private extractParcelNo(row: ExcelRow): string | null {
    const raw = row[0] ?? '';
    const parts = raw.split(':');
    return parts[1]?.trim() || null;
  }

  private buildParcelHeader(
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
      const regex = /\d+\s+to\s+(\d+)/i;
      const match = regex.exec(parcelNo);
      if (match?.[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) {
          total = num;
        }
      }
    }

    // item type
    const itemType = this.detectItemType(rows, start, end);

    return {
      purchaseOrderNumber: poNum,
      parcelFrom: from,
      parcelTo: to,
      packingListNumber: plNum,
      totalNumberOfParcels: total,
      itemType,
    };
  }

  private buildParcelItems(
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

  private detectItemType(rows: ExcelRow[], start: number, end: number): Parcel['itemType'] {
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
}
