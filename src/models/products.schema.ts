import { pgTable, timestamp, varchar, uuid, json } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  unidataId: uuid('unidata_id'),
  productCode: varchar('product_code', { length: 50 }),
  type: varchar('type', { length: 50 }),
  state: varchar('state', { length: 50 }),
  standardizationLevel: varchar('standardization_level', { length: 50 }),
  labels: json('labels'),
  sourceSystem: varchar('source_system', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
