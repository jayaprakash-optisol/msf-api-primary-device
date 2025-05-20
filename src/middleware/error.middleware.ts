import { type NextFunction, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import env from '../config/env.config';
import { type AuthRequest } from '../types';
import {
  AppError,
  BadRequestError,
  DB_ERROR_CODES,
  isPgError,
  UnauthorizedError,
  NotFoundError,
} from '../utils/error.util';
import { logger } from '../utils/logger';

// Define user interface for request
type RequestWithUser = AuthRequest;

// Helper functions to reduce complexity in the main error handler
const handlePgError = (error: {
  code: string;
  detail?: string;
  message?: string;
}): { statusCode: number; message: string; error: AppError } => {
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message = error.message || 'Database error';
  let transformedError: AppError;

  switch (error.code) {
    case DB_ERROR_CODES.UNIQUE_VIOLATION:
      statusCode = StatusCodes.CONFLICT;
      message = error.detail ?? 'Duplicate key value violates unique constraint';
      transformedError = new AppError(message, statusCode);
      break;
    case DB_ERROR_CODES.FOREIGN_KEY_VIOLATION:
      statusCode = StatusCodes.BAD_REQUEST;
      message = error.detail ?? 'Foreign key violation';
      transformedError = new BadRequestError(message);
      break;
    default:
      transformedError = new AppError(message, statusCode, false);
  }

  return { statusCode, message, error: transformedError };
};

const handleJwtError = (
  error: Error & { name: string },
): { statusCode: number; message: string; error: AppError } => {
  let message = 'Authentication error';

  if (error.name === 'JsonWebTokenError') {
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    message = 'Token expired';
  }

  return {
    statusCode: StatusCodes.UNAUTHORIZED,
    message,
    error: new UnauthorizedError(message),
  };
};

// 404 route handler
export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError('Route not found'));
};

// Helper to handle error messages properly
const getErrorMessage = (error: Error): string => {
  if (error.message === null) {
    return null as unknown as string;
  }
  if (error.message === '') {
    return '';
  }
  return error.message || 'Something went wrong';
};

// Main error handler
export const errorHandler = (
  err: unknown,
  req: RequestWithUser,
  res: Response,
  _next: NextFunction,
): void => {
  // Default to internal server error
  let statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
  let message: string;
  let error: Error | AppError = err instanceof Error ? err : new Error(String(err));

  // Handle known errors
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  }
  // Handle standard JS errors
  else {
    message = getErrorMessage(error);

    // Handle PostgreSQL errors
    if (isPgError(error)) {
      const result = handlePgError(error as { code: string; detail?: string; message?: string });
      statusCode = result.statusCode;
      message = result.message;
      error = result.error;
    }
    // Handle JWT errors
    else if ('name' in error) {
      const isJwtError = error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError';
      if (isJwtError) {
        const result = handleJwtError(error as Error & { name: string });
        statusCode = result.statusCode;
        message = result.message;
        error = result.error;
      }
    }
  }

  // Log errors
  const logObject = {
    message: `[${req.method}] ${req.path} - ${statusCode}: ${message}`,
    requestId: req.headers['x-request-id'],
    userId: req.user?.id,
    path: req.path,
  };

  if (statusCode >= 500) {
    logger.error({ ...logObject, error: error.stack, method: req.method, ip: req.ip });
  } else {
    logger.warn(logObject);
  }

  // Send error response
  const response = {
    success: false,
    error: message,
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  res.status(statusCode).json(response);
};
