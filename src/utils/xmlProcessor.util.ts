import { parseStringPromise } from 'xml2js';
import { FileUploadError } from '../utils';
import { DbPayload, Parcel, ParcelItem, Product } from '../types';

export class XMLProcessor {
  /**
   * Process an XML file and return the parsed data
   */
  static async processXML(fileContent: Buffer): Promise<DbPayload[]> {
    try {
      const xmlData = await parseStringPromise(fileContent.toString(), {
        explicitArray: false,
        mergeAttrs: true,
      });

      const xmlFormat = this.detectXMLFormat(xmlData);
      this.validateXMLFormat(xmlData, xmlFormat);

      if (xmlFormat === 'standard') {
        return this.processStandardXML(xmlData);
      } else {
        return this.processExcelXML(xmlData);
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
  private static detectXMLFormat(xmlData: any): 'standard' | 'excel' {
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
  private static validateXMLFormat(xmlData: any, format: 'standard' | 'excel'): void {
    if (format === 'standard') {
      this.validateStandardXML(xmlData);
    } else {
      this.validateExcelXML(xmlData);
    }
  }

  /**
   * Validate standard XML format
   */
  private static validateStandardXML(xmlData: any): void {
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
  private static validateExcelXML(xmlData: any): void {
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

  /**
   * Process standard XML format (UF_cargo format)
   */
  private static processStandardXML(xmlData: any): DbPayload[] {
    const record = xmlData.data.record;
    const purchaseOrderNumber = this.extractPurchaseOrderNumber(record);
    const parcelFrom = this.extractPartnerName(record);
    const moveLines = this.extractMoveLines(record);

    if (!moveLines) {
      return this.createEmptyPayload(purchaseOrderNumber, parcelFrom);
    }

    const moveLineRecord = Array.isArray(moveLines.record) ? moveLines.record : [moveLines.record];
    return moveLineRecord.map((moveRecord: any) =>
      this.processMoveRecord(moveRecord, purchaseOrderNumber),
    );
  }

  /**
   * Extract purchase order number from standard XML record
   */
  private static extractPurchaseOrderNumber(record: any): string | null {
    const originField = record.field.find((f: any) => f.name === 'origin');
    return originField?._ || originField || null;
  }

  /**
   * Extract partner name from standard XML record
   */
  private static extractPartnerName(record: any): string | null {
    const partnerField = record.field.find((f: any) => f.name === 'partner_id');
    if (!partnerField?.field) return null;

    if (Array.isArray(partnerField.field)) {
      const nameField = partnerField.field.find((f: any) => f.name === 'name');
      return nameField?._ || nameField || null;
    }

    return partnerField.field._ || partnerField.field.name || null;
  }

  /**
   * Extract move lines from standard XML record
   */
  private static extractMoveLines(record: any): any | null {
    const moveLines = record.field.find((f: any) => f.name === 'move_lines');
    return moveLines?.record ? moveLines : null;
  }

  /**
   * Create empty payload when no move lines exist
   */
  private static createEmptyPayload(
    purchaseOrderNumber: string | null,
    parcelFrom: string | null,
  ): DbPayload[] {
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

  /**
   * Process a single move record
   */
  private static processMoveRecord(moveRecord: any, purchaseOrderNumber: string | null): DbPayload {
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
      itemType: 'Regular',
    };

    const parcelItems = this.processStandardXMLItems(
      moveRecord,
      weight,
      volume,
      parcelFromNum,
      parcelToNum,
    );

    return { parcel, parcelItems };
  }

  /**
   * Process items from standard XML format
   */
  private static processStandardXMLItems(
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
      const { productCode, productDescription } = this.extractProductInfo(productRecord);
      if (!productCode) return;

      // Extract quantity and unit
      const quantity = getProductFieldValue('product_qty');
      const unit = this.extractUnitOfMeasure(productRecord);
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
  private static extractProductInfo(productRecord: any): {
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
  private static extractUnitOfMeasure(productRecord: any): string | null {
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

  /**
   * Process Excel XML format (61320_incoming format)
   */
  private static processExcelXML(xmlData: any): DbPayload[] {
    const workbook = xmlData.Workbook || xmlData['ss:Workbook'];
    const worksheet = workbook.Worksheet || workbook['ss:Worksheet'];
    const table = worksheet.Table || worksheet['ss:Table'];
    const rows = Array.isArray(table.Row || table['ss:Row'])
      ? table.Row || table['ss:Row']
      : [table.Row || table['ss:Row']];

    const origin = this.getHeaderValue(rows, 2, 1);
    return this.processExcelXMLRows(rows, origin);
  }

  /**
   * Process rows from Excel XML and build parcels
   */
  private static processExcelXMLRows(rows: any[], origin: string | null): DbPayload[] {
    const result: DbPayload[] = [];
    let currentParcel: Partial<Parcel> & { weight?: string; volume?: string } = {};
    let currentParcelItems: ParcelItem[] = [];

    for (const row of rows) {
      if (!row || (!row.Cell && !row['ss:Cell'])) continue;

      const cells = Array.isArray(row.Cell || row['ss:Cell'])
        ? row.Cell || row['ss:Cell']
        : [row.Cell || row['ss:Cell']];

      const processed = this.processExcelXMLRow(
        cells,
        currentParcel,
        currentParcelItems,
        origin,
        result,
      );
      currentParcel = processed.currentParcel;
      currentParcelItems = processed.currentParcelItems;
    }

    this.addFinalParcel(result, currentParcel, currentParcelItems);
    return result;
  }

  /**
   * Process a single Excel XML row
   */
  private static processExcelXMLRow(
    cells: any[],
    currentParcel: Partial<Parcel> & { weight?: string; volume?: string },
    currentParcelItems: ParcelItem[],
    origin: string | null,
    result: DbPayload[],
  ): {
    currentParcel: Partial<Parcel> & { weight?: string; volume?: string };
    currentParcelItems: ParcelItem[];
  } {
    const firstCellData = cells[0]?.Data || cells[0]?.['ss:Data'];
    const firstCell = firstCellData?._ || firstCellData || '';

    if (firstCell === '#') {
      this.addFinalParcel(result, currentParcel, currentParcelItems);
      return {
        currentParcel: this.buildExcelXMLParcel(cells, origin),
        currentParcelItems: [],
      };
    } else if (firstCell && /^\d+$/.test(firstCell)) {
      const parcelItem = this.buildExcelXMLParcelItem(cells, currentParcel);
      if (parcelItem) {
        currentParcelItems.push(parcelItem);
      }
    }

    return { currentParcel, currentParcelItems };
  }

  /**
   * Add final parcel to result if it exists
   */
  private static addFinalParcel(
    result: DbPayload[],
    currentParcel: Partial<Parcel> & { weight?: string; volume?: string },
    currentParcelItems: ParcelItem[],
  ): void {
    if (currentParcel.purchaseOrderNumber) {
      // Remove weight and volume from parcel before adding to result
      const { weight: _weight, volume: _volume, ...parcelData } = currentParcel;
      result.push({
        parcel: parcelData as Parcel,
        parcelItems: currentParcelItems,
      });
    }
  }

  /**
   * Get header value from Excel XML rows
   */
  private static getHeaderValue(
    rows: any[],
    rowIndex: number,
    cellIndex: number = 1,
  ): string | null {
    const row = rows[rowIndex];
    if (!row || (!row.Cell && !row['ss:Cell'])) return null;
    const cells = Array.isArray(row.Cell || row['ss:Cell'])
      ? row.Cell || row['ss:Cell']
      : [row.Cell || row['ss:Cell']];
    const cell = cells[cellIndex];
    const data = cell?.Data || cell?.['ss:Data'];
    const value = this.extractStringValue(data);

    // Remove trailing colon if present (e.g., "24/MBE/LB107/00010:" -> "24/MBE/LB107/00010")
    return value?.endsWith(':') ? value.slice(0, -1) : value;
  }

  /**
   * Build parcel object from Excel XML cells
   */
  private static buildExcelXMLParcel(
    cells: any[],
    origin: string | null,
  ): Partial<Parcel> & { weight?: string; volume?: string } {
    const parcelQtyData = cells[1]?.Data || cells[1]?.['ss:Data'];
    const parcelQty = this.extractStringValue(parcelQtyData) || '1';
    const parcelFromData = cells[2]?.Data || cells[2]?.['ss:Data'];
    const parcelFrom = this.extractStringValue(parcelFromData) || '1';
    const parcelToData = cells[3]?.Data || cells[3]?.['ss:Data'];
    const parcelTo = this.extractStringValue(parcelToData) || '1';
    const weightData = cells[4]?.Data || cells[4]?.['ss:Data'];
    const weight = this.extractStringValue(weightData);
    const volumeData = cells[5]?.Data || cells[5]?.['ss:Data'];
    const volume = this.extractStringValue(volumeData);
    const packingListData = cells[9]?.Data || cells[9]?.['ss:Data'];
    const packingList = this.extractStringValue(packingListData);

    return {
      purchaseOrderNumber: origin,
      parcelFrom: parcelFrom,
      parcelTo: parcelTo,
      packingListNumber: packingList,
      totalNumberOfParcels: parseInt(parcelQty, 10) || 1,
      itemType: 'Regular',
      weight: weight || undefined,
      volume: volume || undefined,
    };
  }

  /**
   * Build parcel item from Excel XML cells
   */
  private static buildExcelXMLParcelItem(
    cells: any[],
    currentParcel: Partial<Parcel> & { weight?: string; volume?: string },
  ): ParcelItem | null {
    const productCodeData = cells[2]?.Data || cells[2]?.['ss:Data'];
    const productCode = this.extractStringValue(productCodeData);

    if (!productCode) return null;

    const productDescriptionData = cells[3]?.Data || cells[3]?.['ss:Data'];
    const productDescription = this.extractStringValue(productDescriptionData);
    const quantityData = cells[4]?.Data || cells[4]?.['ss:Data'];
    const quantity = this.extractStringValue(quantityData);
    const uomData = cells[5]?.Data || cells[5]?.['ss:Data'];
    const uom = this.extractStringValue(uomData);
    const batchData = cells[8]?.Data || cells[8]?.['ss:Data'];
    const batch = this.extractStringValue(batchData);
    const expiryDateData = cells[9]?.Data || cells[9]?.['ss:Data'];
    const expiryDate = this.extractStringValue(expiryDateData);

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
      weight: currentParcel.weight || null,
      volume: currentParcel.volume || null,
      product,
    };
  }

  /**
   * Extract string value from XML data, handling both string and object cases
   */
  private static extractStringValue(data: any): string | null {
    if (!data) return null;

    if (typeof data === 'string') {
      return this.trimToNull(data);
    }

    if (typeof data === 'object') {
      return this.extractFromObject(data);
    }

    return null;
  }

  /**
   * Trim string and return null if empty
   */
  private static trimToNull(value: string): string | null {
    return value.trim() || null;
  }

  /**
   * Extract string value from object data
   */
  private static extractFromObject(data: any): string | null {
    if (data._ !== undefined) {
      return typeof data._ === 'string' ? this.trimToNull(data._) : null;
    }
    return null;
  }
}
