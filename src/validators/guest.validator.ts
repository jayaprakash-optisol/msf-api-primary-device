import { createValidator } from '../utils/validator.util';
import { z } from 'zod';

export const guestLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const validateGuestLogin = createValidator(guestLoginSchema);
