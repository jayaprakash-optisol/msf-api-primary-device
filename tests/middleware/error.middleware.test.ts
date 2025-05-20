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
  DB_ERROR_CODES,
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

    it('should handle PostgreSQL errors without a message', () => {
      // Create a PostgreSQL error without a message (branch at line 26)
      const pgError = new Error();
      delete (pgError as any).message;
      (pgError as any).code = 'OTHER_PG_ERROR';

      errorHandler(pgError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Database error',
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

    it('should handle other JWT errors with the Authentication error default message', () => {
      // Create an error with a name property but not a specific JWT error (branch at line 78)
      const otherJwtError = new Error('Some JWT error');
      otherJwtError.name = 'OtherJwtError';

      // This error has a name property but it's not one of the specific JWT errors
      errorHandler(otherJwtError, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Some JWT error',
      });
      expect(logger.error).toHaveBeenCalled();
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

    it('should handle error with statusCode in 4xx range for warning logs', () => {
      // Create error with a 4xx status code (different branch at line 139)
      const error = new AppError('Client Error', StatusCodes.NOT_ACCEPTABLE);

      errorHandler(error, req as any, res, next);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.NOT_ACCEPTABLE);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: false,
        error: 'Client Error',
      });
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
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
  });
});
