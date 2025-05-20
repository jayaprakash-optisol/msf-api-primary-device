import { StatusCodes } from 'http-status-codes';
import { type ZodError } from 'zod';
import { logger } from './logger';

/**
 * Base AppError class for all application errors
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Error.captureStackTrace?.(this, this.constructor);

    // Log non-operational errors immediately as they are likely programming errors
    if (!isOperational) {
      logger.error('Programming Error:', {
        message: this.message,
        stack: this.stack,
        code: this.code,
      });
    }
  }
}

/**
 * HTTP 400 Bad Request error
 */
export class BadRequestError extends AppError {
  constructor(message: string, code?: string, details?: unknown) {
    super(message, StatusCodes.BAD_REQUEST, true, code, details);
  }
}

/**
 * HTTP 401 Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code?: string, details?: unknown) {
    super(message, StatusCodes.UNAUTHORIZED, true, code, details);
  }
}

/**
 * HTTP 403 Forbidden error
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code?: string, details?: unknown) {
    super(message, StatusCodes.FORBIDDEN, true, code, details);
  }
}

/**
 * HTTP 404 Not Found error
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code?: string, details?: unknown) {
    super(message, StatusCodes.NOT_FOUND, true, code, details);
  }
}

/**
 * HTTP 409 Conflict error
 */
export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code?: string, details?: unknown) {
    super(message, StatusCodes.CONFLICT, true, code, details);
  }
}

/**
 * HTTP 422 Unprocessable Entity error
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation error', code?: string, details?: unknown) {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY, true, code, details);
  }
}

/**
 * HTTP 429 Too Many Requests error
 */
export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', code?: string, details?: unknown) {
    super(message, StatusCodes.TOO_MANY_REQUESTS, true, code, details);
  }
}

/**
 * HTTP 500 Internal Server Error
 * Note: isOperational is false by default as these are typically programming errors
 */
export class InternalServerError extends AppError {
  constructor(
    message = 'Internal server error',
    isOperational = false,
    code?: string,
    details?: unknown,
  ) {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, isOperational, code, details);
  }
}

/**
 * HTTP 503 Service Unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', code?: string, details?: unknown) {
    super(message, StatusCodes.SERVICE_UNAVAILABLE, true, code, details);
  }
}

/**
 * Database specific error
 */
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR, false);
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};

/**
 * Type guard to check if an error is a PostgreSQL error
 */
export const isPgError = (error: unknown): error is { code: string; detail?: string } => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  );
};

/**
 * Format ZodError for API response
 */
export const formatZodError = (error: ZodError): string => {
  return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
};

/**
 * Common error codes for database operations
 */
export const DB_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  CHECK_VIOLATION: '23514',
  NOT_NULL_VIOLATION: '23502',
};

/**
 * Factory functions for creating errors
 */
export const createError = {
  badRequest: (message: string, code?: string, details?: unknown) =>
    new BadRequestError(message, code, details),

  unauthorized: (message = 'Unauthorized', code?: string, details?: unknown) =>
    new UnauthorizedError(message, code, details),

  forbidden: (message = 'Forbidden', code?: string, details?: unknown) =>
    new ForbiddenError(message, code, details),

  notFound: (message = 'Resource not found', code?: string, details?: unknown) =>
    new NotFoundError(message, code, details),

  conflict: (message = 'Resource conflict', code?: string, details?: unknown) =>
    new ConflictError(message, code, details),

  validation: (message = 'Validation error', code?: string, details?: unknown) =>
    new ValidationError(message, code, details),

  tooManyRequests: (message = 'Too many requests', code?: string, details?: unknown) =>
    new TooManyRequestsError(message, code, details),

  internal: (
    message = 'Internal server error',
    isOperational = false,
    code?: string,
    details?: unknown,
  ) => new InternalServerError(message, isOperational, code, details),

  serviceUnavailable: (message = 'Service unavailable', code?: string, details?: unknown) =>
    new ServiceUnavailableError(message, code, details),
};
