import { boolean, pgTable, timestamp, varchar, uuid } from 'drizzle-orm/pg-core';
import { guestRoleEnum, guestStatusEnum } from './enums';

export const guests = pgTable('guests', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  location: varchar('location', { length: 100 }).notNull(),
  role: guestRoleEnum('role').notNull(),
  accessPeriod: varchar('access_period', { length: 50 }).notNull(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  status: guestStatusEnum('status').default('Active').notNull(),
  credentialsViewed: boolean('credentials_viewed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
