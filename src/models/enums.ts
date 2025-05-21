import { pgEnum } from 'drizzle-orm/pg-core';

// User Role Enum
export const roleEnum = pgEnum('role', ['Admin', 'User']);

// Guest Role Enum
export const guestRoleEnum = pgEnum('guest_role', ['Stock Manager', 'Store Keeper', 'Guest User']);

// Guest Status Enum
export const guestStatusEnum = pgEnum('guest_status', ['Active', 'Inactive', 'Expired']);
