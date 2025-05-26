import { pgTable, timestamp, varchar, uuid, integer, decimal } from 'drizzle-orm/pg-core';
import { products } from './products.schema';
import { relations } from 'drizzle-orm';
import { parcels } from './parcels.schema';

export const parcelItems = pgTable('parcel_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').references(() => products.id),
  parcelId: uuid('parcel_id').references(() => parcels.id),

  productQuantity: integer('product_quantity'),
  productCode: varchar('product_code'),
  expiryDate: timestamp('expiry_date'),
  batchNumber: varchar('batch_number', { length: 50 }),
  weight: decimal('weight', { precision: 9, scale: 3 }),
  volume: decimal('volume', { precision: 9, scale: 3 }),
  parcelNumber: varchar('parcel_number', { length: 50 }),

  lineNumber: integer('line_number'),
  externalRef: varchar('external_ref', { length: 50 }),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }),
  currencyUnit: varchar('currency_unit', { length: 50 }),
  unitPrice: decimal('unit_price'),
  messageEsc1: varchar('message_esc1', { length: 255 }),
  messageEsc2: varchar('message_esc2', { length: 255 }),
  comments: varchar('comments', { length: 255 }),
  contains: varchar('contains', { length: 255 }),
  sourceSystem: varchar('source_system', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations 1-1 between parcelItems and products
export const parcelItemsRelations = relations(parcelItems, ({ one }) => ({
  product: one(products, {
    fields: [parcelItems.productId],
    references: [products.id],
  }),
}));
