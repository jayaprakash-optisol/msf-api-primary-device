import { decimal, pgTable, varchar, uuid, timestamp, integer } from 'drizzle-orm/pg-core';

// Define the parcels table
export const parcels = pgTable('parcels', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderNumber: varchar('purchase_order_number'),
  parcelFrom: integer('parcel_from'),
  parcelTo: integer('parcel_to'),
  totalWeight: decimal('total_weight', { precision: 9, scale: 3 }),
  totalVolume: decimal('total_volume', { precision: 9, scale: 3 }),
  totalNumberOfParcels: integer('total_number_of_parcels'),

  packageWeight: decimal('package_weight', { precision: 9, scale: 3 }),
  packageVolume: decimal('package_volume', { precision: 9, scale: 3 }),
  firstParcelNumber: integer('first_parcel_number'),
  lastParcelNumber: integer('last_parcel_number'),
  parcelQuantity: integer('parcel_quantity'),
  totalHeight: decimal('total_height', { precision: 9, scale: 3 }),
  totalLength: decimal('total_length', { precision: 9, scale: 3 }),
  totalWidth: decimal('total_width', { precision: 9, scale: 3 }),
  packingListNumber: varchar('packing_list_number', { length: 50 }),
  messageEsc1: varchar('message_esc1', { length: 255 }),
  messageEsc2: varchar('message_esc2', { length: 255 }),
  sourceSystem: varchar('source_system', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
