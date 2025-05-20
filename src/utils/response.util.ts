import { type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import env from '../config/env.config';
import { type ServiceResponse } from '../types';

import { encrypt } from './encryption.util';
import { logger } from './logger';
import {
  BadRequestError,
  ConflictError,
  DatabaseError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from './error.util';

// ===== SERVICE RESPONSES =====

/**
 * Create a standardized service response
 */
export const createServiceResponse = <T>(
  success: boolean,
  data?: T | null,
  error?: string | null,
  statusCode = StatusCodes.OK,
): ServiceResponse<T> => {
  const message = success ? 'Operation successful' : (error ?? 'Operation failed');
  logger.debug('Service response:', { success, hasData: !!data, statusCode });

  return { success, data, error, statusCode, message };
};

/**
 * Create a success service response
 */
export const createSuccessResponse = <T>(
  data?: T,
  message = 'Operation successful',
  statusCode = StatusCodes.OK,
): ServiceResponse<T> => {
  const response = createServiceResponse<T>(true, data, null, statusCode);
  response.message = message;
  return response;
};

// ===== EXPRESS RESPONSE HELPERS =====

/**
 * Send a success response through Express
 */
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message = 'Operation successful',
  statusCode = StatusCodes.OK,
): void => {
  try {
    const encryptedData = env?.ENCRYPTION_ENABLED ? encrypt(JSON.stringify(data)) : data;
    const response = createSuccessResponse(encryptedData, message, statusCode);
    res.status(response.statusCode).json(response);
  } catch (error) {
    logger.error('Error sending success response:', error);
    throw error;
  }
};

// ===== BACKWARD COMPATIBILITY =====

/**
 * Service success response (backward compatible api)
 */
export const _ok = <T>(data: T, message = '', code = StatusCodes.OK): ServiceResponse<T> => {
  return createSuccessResponse(data, message || 'Operation successful', code);
};

/**
 * Utility function to handle errors in services
 * This helper rethrows domain errors and wraps unknown errors in InternalServerError
 *
 * @param error The caught error
 * @param context Optional context message for logging
 */
export function handleServiceError(error: unknown, context = 'Service operation failed'): never {
  // Check if this is a database unique constraint violation
  if (error instanceof Error && 'code' in error && error.code === '23505') {
    throw new ConflictError('Resource already exists');
  }

  // Pass through application domain errors
  if (
    error instanceof BadRequestError ||
    error instanceof NotFoundError ||
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    error instanceof ConflictError ||
    error instanceof DatabaseError
  ) {
    throw error;
  }

  // Wrap unknown errors with InternalServerError
  throw new InternalServerError(
    error instanceof Error ? `${context}: ${error.message}` : String(context),
  );
}
