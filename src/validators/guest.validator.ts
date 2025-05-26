import { createValidator } from '../utils/validator.util';
import { z } from 'zod';

export const guestLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

export const validateGuestLogin = createValidator(guestLoginSchema);
