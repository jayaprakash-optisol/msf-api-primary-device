import { pgEnum } from 'drizzle-orm/pg-core';

// Guest Role Enum
export const guestRoleEnum = pgEnum('guest_role', ['Stock Manager', 'Store Keeper', 'Guest User']);

// Guest Status Enum
export const guestStatusEnum = pgEnum('guest_status', ['Active', 'Inactive', 'Expired']);
