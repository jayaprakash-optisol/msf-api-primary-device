import { type NextFunction, type Request, type Response } from 'express';

/**
 * Wrapper for async route handlers to catch errors and forward to error middleware
 * This eliminates the need for try/catch blocks in each controller method
 * @param fn The async controller function to wrap
 */
export const asyncHandler = <T extends Request = Request, U extends Response = Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<unknown>,
) => {
  return (req: T, res: U, next: NextFunction): void => {
    // Execute the function and catch any errors to pass to the error middleware
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
