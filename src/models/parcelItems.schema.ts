import { pgTable, timestamp, varchar, uuid, integer, decimal } from 'drizzle-orm/pg-core';
import { products } from './products.schema';
import { relations } from 'drizzle-orm';

export const parcelItems = pgTable('parcel_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  productQuantity: integer('product_quantity').notNull(),
  productCode: varchar('product_code').notNull(),
  lineNumber: integer('line_number').notNull(),
  expiryDate: timestamp('expiry_date').notNull(),
  batchNumber: varchar('batch_number', { length: 50 }).notNull(),
  externalRef: varchar('external_ref', { length: 50 }).notNull(),
  unitOfMeasure: varchar('unit_of_measure', { length: 50 }).notNull(),
  currencyUnit: varchar('currency_unit', { length: 50 }).notNull(),
  unitPrice: decimal('unit_price').notNull(),
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
