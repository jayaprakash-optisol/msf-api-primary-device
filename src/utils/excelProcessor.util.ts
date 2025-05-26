import * as XLSX from 'xlsx';
import { FileUploadError } from '../utils';
import { DbPayload, Parcel, ParcelItem, Product } from '../types';

// Define Excel row type for internal use
type ExcelRow = Array<string | null>;

export class ExcelProcessor {
  /**
   * Process an XLSX file and return the parsed data
   */
  static async processXLSX(fileContent: Buffer): Promise<DbPayload[]> {
    const wb = XLSX.read(fileContent, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
      header: 1,
      raw: false,
      defval: null,
      dateNF: 'yyyy-mm-dd',
      blankrows: false,
    });

    this.validateXlsxFormat(rows);
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

    return starts.map((start, idx) => {
      const end = idx + 1 < starts.length ? starts[idx + 1] : rows.length;
      const parcelNo = this.extractParcelNo(rows[start]);
      const parcel = this.buildParcelHeader(rows, start, end, parcelNo);
      const parcelItems = this.buildParcelItems(rows, start, end, parcelNo);
      return { parcel, parcelItems };
    });
  }

  /**
   * Validate the format of an XLSX file
   */
  private static validateXlsxFormat(rows: ExcelRow[]): void {
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
  private static findParcelStarts(rows: ExcelRow[]): number[] {
    return rows.map((row, i) => (row[0]?.startsWith('Parcel No:') ? i : -1)).filter(i => i >= 0);
  }

  /**
   * Extract the parcel number from a row
   */
  private static extractParcelNo(row: ExcelRow): string | null {
    const raw = row[0] ?? '';
    const parts = raw.split(':');
    return parts[1]?.trim() || null;
  }

  /**
   * Build the parcel header from the uploaded file
   */
  private static buildParcelHeader(
    rows: ExcelRow[],
    start: number,
    end: number,
    parcelNo: string | null,
  ): Parcel {
    const purchaseOrderNumber = this.extractPurchaseOrderNumber(rows, start);
    const packingListNumber = this.extractPackingListNumber(rows, start);
    const { parcelFrom, parcelTo } = this.extractShipperDispatchInfo(rows, start);
    const totalNumberOfParcels = this.extractTotalParcels(parcelNo);
    const itemType = this.detectItemType(rows, start, end);

    return {
      purchaseOrderNumber,
      parcelFrom,
      parcelTo,
      packingListNumber,
      totalNumberOfParcels,
      itemType,
    };
  }

  /**
   * Extract purchase order number from rows
   */
  private static extractPurchaseOrderNumber(rows: ExcelRow[], start: number): string | null {
    const ourRow = this.findRowUp(rows, start, 'Our Ref.:');
    return ourRow >= 0 ? this.toStr(rows[ourRow][2]) : null;
  }

  /**
   * Extract packing list number from rows
   */
  private static extractPackingListNumber(rows: ExcelRow[], start: number): string | null {
    const plRow = this.findRowUp(rows, start, 'PACKING LIST');
    return plRow >= 0 ? this.toStr(rows[plRow + 1]?.[0]) : null;
  }

  /**
   * Extract shipper and dispatch information
   */
  private static extractShipperDispatchInfo(
    rows: ExcelRow[],
    start: number,
  ): { parcelFrom: string | null; parcelTo: string | null } {
    const hdrRow = rows.findIndex(
      (r, i) => i <= start && r.some((c: string | null) => /shipper/i.test(c ?? '')),
    );

    if (hdrRow < 0) {
      return { parcelFrom: null, parcelTo: null };
    }

    const hdr = rows[hdrRow];
    const vals = rows[hdrRow + 1] ?? [];
    const shipIdx = hdr.findIndex((c: string | null) => /^shipper:/i.test(c ?? ''));
    const dispIdx = hdr.findIndex((c: string | null) => /^dispatch:/i.test(c ?? ''));

    return {
      parcelFrom: shipIdx >= 0 ? this.toStr(vals[shipIdx]) : null,
      parcelTo: dispIdx >= 0 ? this.toStr(vals[dispIdx]) : null,
    };
  }

  /**
   * Extract total number of parcels from parcel number
   */
  private static extractTotalParcels(parcelNo: string | null): number {
    if (!parcelNo) return 1;

    const regex = /^\d+[ \t]{1,3}to[ \t]{1,3}(\d+)$/i;
    const match = regex.exec(parcelNo);

    if (!match?.[1]) return 1;

    const num = parseInt(match[1], 10);
    return isNaN(num) ? 1 : num;
  }

  /**
   * Find a row starting with a label, searching upward from start
   */
  private static findRowUp(rows: ExcelRow[], start: number, label: string): number {
    for (let r = start; r >= 0; r--) {
      if (rows[r][0]?.startsWith(label)) return r;
    }
    return -1;
  }

  /**
   * Convert value to trimmed string or null
   */
  private static toStr(v: string | null): string | null {
    return v ? v.trim() : null;
  }

  /**
   * Build the parcel items from the uploaded file
   */
  private static buildParcelItems(
    rows: ExcelRow[],
    start: number,
    end: number,
    parcelNo: string | null,
  ): ParcelItem[] {
    // Extract weight/volume
    const info = this.toStr(rows[start][3]);
    const weight = info?.match(/Total weight\s*([\d.]+)/i)?.[1] ?? null;
    const volume = info?.match(/Total volume\s*([\d.]+)/i)?.[1] ?? null;

    const hdr = rows[start + 1].map((v: string | null) => this.toStr(v));
    const idxOf = (label: string) => hdr.findIndex((h: string | null) => h === label);

    const items: ParcelItem[] = [];
    for (let r = start + 2; r < end; r++) {
      const row = rows[r];
      if (!row[0]) break;

      const productCode = this.toStr(row[idxOf('Code')]);
      const productDescription = this.toStr(row[idxOf('Description')]);

      // Skip rows without a product code
      if (!productCode) continue;

      const product: Product = {
        productCode,
        productDescription,
      };

      items.push({
        parcelNo,
        productQuantity: this.toStr(row[idxOf('Total Qty.')]),
        batchNumber: this.toStr(row[idxOf('Batch')]),
        expiryDate: this.toStr(row[idxOf('Exp. Date')]),
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
  private static detectItemType(rows: ExcelRow[], start: number, end: number): Parcel['itemType'] {
    let type: Parcel['itemType'] = 'Regular';
    for (let r = start; r < end; r++) {
      const row = rows[r];
      if (row.some((c: string | null) => /Containing:?/i.test(c ?? ''))) {
        const labels = rows[r + 1] ?? [];
        const vals = rows[r + 2] ?? [];
        labels.forEach((cell: string | null, idx: number) => {
          const lbl = cell?.trim()?.toLowerCase() ?? null;
          const val = vals[idx]?.trim()?.toLowerCase() ?? null;
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
