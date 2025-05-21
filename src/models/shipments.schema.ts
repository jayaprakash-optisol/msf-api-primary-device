import { pgTable, varchar, uuid, timestamp, integer } from 'drizzle-orm/pg-core';

export const shipments = pgTable('shipments', {
  id: uuid('id').primaryKey().defaultRandom(),
  packingNumber: integer('packing_number'),
  dispatchReference: varchar('dispatch_reference'),
  customerReceiverCode: varchar('customer_receiver_code'),
  orderReference: integer('order_reference'),
  transportMode: varchar('transport_mode'),
  packingStatus: varchar('packing_status'),
  fieldReference: varchar('field_reference'),
  supplierName: varchar('supplier_name'),
  notes: varchar('notes'),
  messageEsc: varchar('message_esc1'),
  freight: varchar('freight'),
  origin: varchar('origin'),
  sourceSystem: varchar('source_system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
