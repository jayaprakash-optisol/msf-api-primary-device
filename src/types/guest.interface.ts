import { type guests } from '../models';
import { type ServiceResponse } from './common.interface';

export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;

export interface IGuestService {
  /**
   * Verify guest credentials
   */
  verifyGuestCredentials(
    username: string,
    password: string,
  ): Promise<ServiceResponse<Omit<Guest, 'password'>>>;
}
