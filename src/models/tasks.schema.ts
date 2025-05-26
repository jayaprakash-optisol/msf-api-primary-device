import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { taskStatusEnum } from './enums';
import { parcels } from './parcels.schema';

// Define the tasks table
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  parcelId: uuid('parcel_id').references(() => parcels.id),
  status: taskStatusEnum('status').default('Yet to Start').notNull(),
  itemType: varchar('item_type', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
