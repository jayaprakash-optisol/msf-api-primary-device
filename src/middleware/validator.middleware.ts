import { type NextFunction, type Request, type Response } from 'express';
import { type AnyZodObject, ZodError } from 'zod';

import { ValidationError, formatZodError } from '../utils';
import { logger } from '../utils/logger';

/**
 * Creates a validation middleware for the specified location in the request
 * @param schema Zod schema to validate against
 * @param source Where to look for data to validate (body, query, params)
 */
export const validate =
  (schema: AnyZodObject, source: 'body' | 'query' | 'params' = 'body') =>
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
        error,
      });

      // Handle validation errors
      if (error instanceof ZodError) {
        const errorMessage = formatZodError(error);
        next(new ValidationError(errorMessage));
      } else {
        next(error);
      }
    }
  };
