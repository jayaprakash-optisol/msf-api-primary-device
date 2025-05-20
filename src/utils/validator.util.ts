import { type NextFunction, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError, type ZodSchema } from 'zod';

import { logger } from './logger';

interface RequestWithUser extends Request {
  user?: {
    id: string;
    userId?: number;
    email: string;
    role: string;
  };
}

/**
 * Formats ZodError into a human-readable error message
 * @param error ZodError instance
 * @returns Formatted error message
 */
export const formatZodError = (error: ZodError): string => {
  return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
};

/**
 * Creates a validation middleware for the specified location in the request
 * @param schema Zod schema to validate against
 * @param source Where to look for data to validate (body, query, params)
 */
export const createValidator =
  (schema: ZodSchema<unknown>, source: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Get data from the specified source
      const data = req[source];

      // Validate data against schema
      schema.parse(data);
      next();
    } catch (error) {
      // Log validation error
      logger.warn(`Validation error in ${source}`, {
        path: req.path,
        method: req.method,
        userId: (req as RequestWithUser).user?.id,
        error,
      });

      // Handle validation errors
      if (error instanceof ZodError) {
        res.status(StatusCodes.BAD_REQUEST).json({
          success: false,
          error: `Validation error: ${formatZodError(error)}`,
        });
      } else {
        next(error);
      }
    }
  };
