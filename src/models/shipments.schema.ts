import { pgTable, varchar, uuid, timestamp, integer } from 'drizzle-orm/pg-core';

export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  packingNumber: integer('packing_number').notNull(),
  dispatchReference: varchar('dispatch_reference').notNull(),
  customerReceiverCode: varchar('customer_receiver_code').notNull(),
  orderReference: integer('order_reference').notNull(),
  transportMode: varchar('transport_mode').notNull(),
  packingStatus: varchar('packing_status').notNull(),
  fieldReference: varchar('field_reference').notNull(),
  supplierName: varchar('supplier_name').notNull(),
  notes: varchar('notes'),
  messageEsc: varchar('message_esc1'),
  freight: varchar('freight').notNull(),
  origin: varchar('origin').notNull(),
  sourceSystem: varchar('source_system', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
