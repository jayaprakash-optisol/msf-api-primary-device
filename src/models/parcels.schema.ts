import { decimal, pgTable, varchar, uuid, timestamp, integer } from 'drizzle-orm/pg-core';

// Define the parcels table
export const parcels = pgTable('parcels', {
  id: uuid('id').primaryKey().defaultRandom(),
  packageWeight: decimal('package_weight', { precision: 9, scale: 3 }),
  packageVolume: decimal('package_volume', { precision: 9, scale: 3 }),
  firstParcelNumber: integer('first_parcel_number'),
  lastParcelNumber: integer('last_parcel_number'),
  totalNumberOfParcels: integer('total_number_of_parcels').notNull(),
  parcelFrom: integer('parcel_from').notNull(),
  parcelTo: integer('parcel_to').notNull(),
  parcelQuantity: integer('parcel_quantity').notNull(),
  totalWeight: decimal('total_weight', { precision: 9, scale: 3 }).notNull(),
  totalVolume: decimal('total_volume', { precision: 9, scale: 3 }).notNull(),
  totalHeight: decimal('total_height', { precision: 9, scale: 3 }).notNull(),
  totalLength: decimal('total_length', { precision: 9, scale: 3 }).notNull(),
  totalWidth: decimal('total_width', { precision: 9, scale: 3 }).notNull(),
  packingListNumber: varchar('packing_list_number', { length: 50 }).notNull(),
  messageEsc1: varchar('message_esc1', { length: 255 }),
  messageEsc2: varchar('message_esc2', { length: 255 }),
  sourceSystem: varchar('source_system', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
