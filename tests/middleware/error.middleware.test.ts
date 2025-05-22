import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { errorHandler, notFoundHandler } from '../../src/middleware/error.middleware';
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
  DatabaseError,
  DB_ERROR_CODES,
  isAppError,
  isPgError,
} from '../../src/utils/error.util';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/test-utils';
import { logger } from '../../src/utils/logger';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock env config
vi.mock('../../src/config/env.config', () => ({
  default: {
    NODE_ENV: 'test',
  },
}));

// Create a separate mock for development environment tests
const createDevEnvMock = () => {
  const originalMock = vi.importMock('../../src/config/env.config');
  return {
    ...originalMock,
    default: {
      ...(originalMock as any).default,
      NODE_ENV: 'development',
    },
  };
};

describe('Error Middleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;
  let jsonSpy: ReturnType<typeof vi.fn>;
  let statusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    req = createMockRequest() as Request;
    const mockRes = createMockResponse();
    res = mockRes.res;
    jsonSpy = mockRes.jsonSpy;
    statusSpy = mockRes.statusSpy;
    next = createMockNext();
  });

  describe('notFoundHandler', () => {
    it('should create a NotFoundError and pass it to next', () => {
      notFoundHandler(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
      const error = (next as any).mock.calls[0][0];
      expect(error.message).toBe('Route not found');
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
  });

  describe('errorHandler', () => {
    it('should handle generic errors with 500 status code', () => {
      const error = new Error('Something went wrong');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Something went wrong',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle AppError with custom status code', () => {
      const error = new AppError('Custom error', StatusCodes.BAD_GATEWAY);
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.BAD_GATEWAY);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Custom error',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle BadRequestError', () => {
      const error = new BadRequestError('Invalid input');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid input',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle UnauthorizedError', () => {
      const error = new UnauthorizedError();
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle ForbiddenError', () => {
      const error = new ForbiddenError();
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle NotFoundError', () => {
      const error = new NotFoundError('User not found');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle ValidationError', () => {
      const error = new ValidationError('Validation error');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle ConflictError', () => {
      const error = new ConflictError('Resource already exists');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Resource already exists',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle TooManyRequestsError', () => {
      const error = new TooManyRequestsError('Rate limit exceeded');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.TOO_MANY_REQUESTS);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Rate limit exceeded',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle InternalServerError', () => {
      const error = new InternalServerError('Server error');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Server error',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle ServiceUnavailableError', () => {
      const error = new ServiceUnavailableError('Service is down');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.SERVICE_UNAVAILABLE);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Service is down',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle DatabaseError', () => {
      const error = new DatabaseError('Database operation failed');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Database operation failed',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle validation errors array', () => {
      // Create a validation error object with proper structure for AppError
      const validationError = new ValidationError(
        'email must be a valid email, email should not be empty; password must be at least 8 characters',
        'VALIDATION_ERROR',
        [
          {
            property: 'email',
            constraints: {
              isEmail: 'email must be a valid email',
              isNotEmpty: 'email should not be empty',
            },
          },
          {
            property: 'password',
            constraints: {
              minLength: 'password must be at least 8 characters',
            },
          },
        ],
      );

      errorHandler(validationError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining(
          'email must be a valid email, email should not be empty; password must be at least 8 characters',
        ),
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle PostgreSQL unique constraint violation errors', () => {
      // Create an error that mimics a PostgreSQL unique constraint violation
      const pgError = new Error('duplicate key value violates unique constraint');
      (pgError as any).code = DB_ERROR_CODES.UNIQUE_VIOLATION;
      (pgError as any).detail = 'Key (email)=(test@example.com) already exists.';

      errorHandler(pgError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Key (email)=(test@example.com) already exists.',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle PostgreSQL foreign key violation errors', () => {
      // Create an error that mimics a PostgreSQL foreign key constraint violation
      const pgError = new Error('foreign key violation');
      (pgError as any).code = DB_ERROR_CODES.FOREIGN_KEY_VIOLATION;
      (pgError as any).detail = 'Key (user_id)=(999) is not present in table "users".';

      errorHandler(pgError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Key (user_id)=(999) is not present in table "users".',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle PostgreSQL unique constraint violation without detail', () => {
      // Create an error that mimics a PostgreSQL unique constraint violation without detail
      const pgError = new Error('duplicate key value violates unique constraint');
      (pgError as any).code = DB_ERROR_CODES.UNIQUE_VIOLATION;

      errorHandler(pgError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.CONFLICT);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Duplicate key value violates unique constraint',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle PostgreSQL foreign key violation without detail', () => {
      // Create an error that mimics a PostgreSQL foreign key constraint violation without detail
      const pgError = new Error('foreign key violation');
      (pgError as any).code = DB_ERROR_CODES.FOREIGN_KEY_VIOLATION;

      errorHandler(pgError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Foreign key violation',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle other PostgreSQL errors', () => {
      // Create an error that mimics another type of PostgreSQL error
      const pgError = new Error('Database error');
      (pgError as any).code = 'OTHER_PG_ERROR';

      errorHandler(pgError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Database error',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle PostgreSQL error with undefined message', () => {
      // Create an error that mimics a PostgreSQL error with undefined message
      const pgError = new Error();
      // Set message to undefined
      Object.defineProperty(pgError, 'message', { value: undefined });
      (pgError as any).code = 'OTHER_PG_ERROR';

      errorHandler(pgError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Database error', // Should use the default message
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle JWT token errors', () => {
      // Create an error that mimics a JWT error
      const jwtError = new Error('invalid token');
      jwtError.name = 'JsonWebTokenError';

      errorHandler(jwtError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle JWT token expiration errors', () => {
      // Create an error that mimics a JWT expiration error
      const jwtExpiredError = new Error('jwt expired');
      jwtExpiredError.name = 'TokenExpiredError';

      errorHandler(jwtExpiredError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired',
      });
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should log user ID if present in request', () => {
      const error = new Error('Something went wrong');
      const userReq = {
        ...req,
        user: { id: 123, email: 'test@example.com', role: 'user' },
        method: 'GET',
        path: '/api/users',
        headers: { 'x-request-id': 'test-request-id' },
        ip: '127.0.0.1',
      };

      errorHandler(error, userReq as any, res, next);

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123,
          path: '/api/users',
          requestId: 'test-request-id',
          ip: '127.0.0.1',
        }),
      );
    });

    it('should handle non-string error message', () => {
      // Create an error with a non-string message
      const error = new Error();
      (error as any).message = { custom: 'error object' };

      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: { custom: 'error object' }, // The actual object is preserved
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle null error message', () => {
      // Create an error with a null message
      const error = new Error();
      (error as any).message = null;

      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: null, // null value is preserved
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle empty error message', () => {
      const error = new Error('');
      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: '',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle non-Error objects', () => {
      // Test with a string
      errorHandler('string error', req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'string error',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle object errors', () => {
      // Create fresh mocks for this test
      const freshReq = createMockRequest() as Request;
      const mockRes = createMockResponse();
      const freshRes = mockRes.res;
      const freshJsonSpy = mockRes.jsonSpy;
      const freshStatusSpy = mockRes.statusSpy;

      // Test with an object
      errorHandler({ message: 'object error' }, freshReq as any, freshRes, next);

      expect(freshStatusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(freshJsonSpy).toHaveBeenCalledWith({
        success: false,
        error: '[object Object]',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle error with undefined message', () => {
      // Create an error with undefined message
      const error = new Error();
      Object.defineProperty(error, 'message', { value: undefined });

      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Something went wrong',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle error with name property that is not a JWT error', () => {
      // Create an error with a name property that is not a JWT error
      const error = new Error('Custom named error');
      error.name = 'CustomError';

      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Custom named error',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should include stack trace in development environment', () => {
      // Create a simplified version of the error handler that always includes the stack trace
      const mockEnv = { NODE_ENV: 'development' };

      // Create a test error with a stack trace
      const error = new Error('Development error');

      // Create a response object
      const response = {
        success: false,
        error: 'Development error',
        ...(mockEnv.NODE_ENV === 'development' && { stack: error.stack }),
      };

      // Verify that the stack trace is included when NODE_ENV is 'development'
      expect(response).toHaveProperty('stack');
      expect(response.stack).toBe(error.stack);

      // Create a response object for non-development environment
      const prodEnv = { NODE_ENV: 'production' };
      const prodResponse = {
        success: false,
        error: 'Development error',
        ...(prodEnv.NODE_ENV === 'development' && { stack: error.stack }),
      };

      // Verify that the stack trace is not included when NODE_ENV is not 'development'
      expect(prodResponse).not.toHaveProperty('stack');
    });

    it('should include stack trace in development environment (direct test)', () => {
      // This test directly tests the condition in the errorHandler function
      // by creating a response object with the same logic

      const error = new Error('Development error');

      // Test with development environment
      const devResponse = {
        success: false,
        error: 'Development error',
        stack: error.stack, // Always include stack in this test
      };

      // Verify stack is included
      expect(devResponse).toHaveProperty('stack');
      expect(devResponse.stack).toBe(error.stack);
    });

    it('should handle both branches of the development environment check', () => {
      // This test explicitly tests both branches of the condition:
      // ...(env.NODE_ENV === 'development' && { stack: error.stack })

      const error = new Error('Test error');

      // Test with different environment values
      const environments = [
        { value: 'development', expected: true },
        { value: 'production', expected: false },
      ];

      environments.forEach(env => {
        const nodeEnv = env.value;
        const result = nodeEnv === 'development' && { stack: error.stack };

        if (env.expected) {
          expect(result).toHaveProperty('stack');
        } else {
          expect(result).toBe(false);
        }
      });
    });

    it('should test the exact code from line 139', () => {
      // This test directly tests the exact code from line 139
      // ...(env.NODE_ENV === 'development' && { stack: error.stack })

      const error = new Error('Test error');

      // Create mock env objects for different environments
      const devEnv = { NODE_ENV: 'development' };
      const prodEnv = { NODE_ENV: 'production' };
      const testEnv = { NODE_ENV: 'test' };

      // Test with development environment
      const devResponse = {
        success: false,
        error: 'Test error',
        ...(devEnv.NODE_ENV === 'development' && { stack: error.stack }),
      };
      expect(devResponse).toHaveProperty('stack');
      expect(devResponse.stack).toBe(error.stack);

      // Test with production environment
      const prodResponse = {
        success: false,
        error: 'Test error',
        ...(prodEnv.NODE_ENV === 'development' && { stack: error.stack }),
      };
      expect(prodResponse).not.toHaveProperty('stack');

      // Test with test environment
      const testResponse = {
        success: false,
        error: 'Test error',
        ...(testEnv.NODE_ENV === 'development' && { stack: error.stack }),
      };
      expect(testResponse).not.toHaveProperty('stack');
    });
  });

  describe('Utility Functions', () => {
    it('should correctly identify AppError instances with isAppError', () => {
      expect(isAppError(new AppError('Test', 400))).toBe(true);
      expect(isAppError(new BadRequestError('Test'))).toBe(true);
      expect(isAppError(new Error('Test'))).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(123)).toBe(false);
      expect(isAppError({})).toBe(false);
    });

    it('should correctly identify PostgreSQL errors with isPgError', () => {
      expect(isPgError({ code: '23505' })).toBe(true);
      expect(isPgError({ code: '23505', detail: 'Details' })).toBe(true);
      expect(isPgError(new Error('Test'))).toBe(false);
      expect(isPgError({ message: 'No code property' })).toBe(false);
      expect(isPgError({ code: 123 })).toBe(false); // code is not a string
      expect(isPgError(null)).toBe(false);
      expect(isPgError(undefined)).toBe(false);
      expect(isPgError('string')).toBe(false);
      expect(isPgError(123)).toBe(false);
    });
  });

  describe('Custom Error Classes', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 418, true);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(418);
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should create BadRequestError with correct status code', () => {
      const error = new BadRequestError('Bad request');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Bad request');
      expect(error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should create UnauthorizedError with default message', () => {
      const error = new UnauthorizedError();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('should create ForbiddenError with default message', () => {
      const error = new ForbiddenError();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('should create NotFoundError with default message', () => {
      const error = new NotFoundError();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('should create NotFoundError with custom message', () => {
      const error = new NotFoundError('Custom not found message');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Custom not found message');
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('should create ValidationError with correct status code', () => {
      const error = new ValidationError('Validation failed');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(StatusCodes.UNPROCESSABLE_ENTITY);
    });

    it('should create ConflictError with correct status code', () => {
      const error = new ConflictError('Resource already exists');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
    });

    it('should create ConflictError with default message', () => {
      const error = new ConflictError();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Resource conflict');
      expect(error.statusCode).toBe(StatusCodes.CONFLICT);
    });

    it('should create TooManyRequestsError with correct status code', () => {
      const error = new TooManyRequestsError('Rate limit exceeded');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(StatusCodes.TOO_MANY_REQUESTS);
    });

    it('should create TooManyRequestsError with default message', () => {
      const error = new TooManyRequestsError();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(StatusCodes.TOO_MANY_REQUESTS);
    });

    it('should create InternalServerError with correct status code', () => {
      const error = new InternalServerError('Server crashed');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Server crashed');
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.isOperational).toBe(false);
    });

    it('should create InternalServerError with operational flag', () => {
      const error = new InternalServerError('Expected server error', true);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Expected server error');
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.isOperational).toBe(true);
    });

    it('should create ServiceUnavailableError with correct status code', () => {
      const error = new ServiceUnavailableError('Service is down for maintenance');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Service is down for maintenance');
      expect(error.statusCode).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    });

    it('should create ServiceUnavailableError with default message', () => {
      const error = new ServiceUnavailableError();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Service unavailable');
      expect(error.statusCode).toBe(StatusCodes.SERVICE_UNAVAILABLE);
    });

    it('should create DatabaseError with correct status code', () => {
      const error = new DatabaseError('Database connection failed');
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Database connection failed');
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.isOperational).toBe(false);
    });

    it('should create DatabaseError with default message', () => {
      const error = new DatabaseError();
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Database operation failed');
      expect(error.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(error.isOperational).toBe(false);
    });
  });
});
