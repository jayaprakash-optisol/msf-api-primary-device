import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import {
  _ok,
  sendSuccess,
  createServiceResponse,
  createSuccessResponse,
  handleServiceError,
} from '../../src/utils/response.util';
import {
  BadRequestError,
  ConflictError,
  DatabaseError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from '../../src/utils/error.util';
import { createMockResponse } from './test-utils';

// Mock encryption utility
vi.mock('../../src/utils/encryption.util', () => ({
  encrypt: vi.fn(data => data),
}));

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock env config
vi.mock('../../src/config/env.config', () => ({
  default: {
    ENCRYPTION_ENABLED: false,
  },
}));

describe('Response Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createServiceResponse', () => {
    it('should create success response', () => {
      const response = createServiceResponse(true, { id: 1 });

      expect(response).toEqual({
        success: true,
        data: { id: 1 },
        error: undefined,
        statusCode: StatusCodes.OK,
        message: 'Operation successful',
      });
    });

    it('should create error response', () => {
      const response = createServiceResponse(
        false,
        null,
        'Error occurred',
        StatusCodes.BAD_REQUEST,
      );

      expect(response).toEqual({
        success: false,
        data: null,
        error: 'Error occurred',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Error occurred',
      });
    });
  });

  describe('createSuccessResponse', () => {
    it('should create a success response with default status code', () => {
      const result = createSuccessResponse({ id: 1 }, 'Success message');

      expect(result).toEqual({
        success: true,
        data: { id: 1 },
        error: null,
        message: 'Success message',
        statusCode: StatusCodes.OK,
      });
    });

    it('should create a success response with custom status code', () => {
      const result = createSuccessResponse({ id: 1 }, 'Created', StatusCodes.CREATED);

      expect(result).toEqual({
        success: true,
        data: { id: 1 },
        error: null,
        message: 'Created',
        statusCode: StatusCodes.CREATED,
      });
    });

    it('should handle undefined data', () => {
      const result = createSuccessResponse(undefined, 'No content', StatusCodes.NO_CONTENT);

      expect(result).toEqual({
        success: true,
        data: undefined,
        error: null,
        message: 'No content',
        statusCode: StatusCodes.NO_CONTENT,
      });
    });
  });

  describe('_ok (backward compatibility)', () => {
    it('should create a success response with default status code', () => {
      const result = _ok({ id: 1 }, 'Success message');

      expect(result).toEqual({
        success: true,
        data: { id: 1 },
        error: null,
        message: 'Success message',
        statusCode: StatusCodes.OK,
      });
    });

    it('should create a success response with custom status code', () => {
      const result = _ok({ id: 1 }, 'Created', StatusCodes.CREATED);

      expect(result).toEqual({
        success: true,
        data: { id: 1 },
        error: null,
        message: 'Created',
        statusCode: StatusCodes.CREATED,
      });
    });

    it('should handle undefined data', () => {
      const result = _ok(undefined, 'No content', StatusCodes.NO_CONTENT);

      expect(result).toEqual({
        success: true,
        data: undefined,
        error: null,
        message: 'No content',
        statusCode: StatusCodes.NO_CONTENT,
      });
    });
  });

  describe('handleServiceError', () => {
    it('should pass through BadRequestError', () => {
      const error = new BadRequestError('Invalid input');

      expect(() => handleServiceError(error, 'Test context')).toThrow(BadRequestError);
      expect(() => handleServiceError(error, 'Test context')).toThrow('Invalid input');
    });

    it('should pass through NotFoundError', () => {
      const error = new NotFoundError('Resource not found');

      expect(() => handleServiceError(error, 'Test context')).toThrow(NotFoundError);
      expect(() => handleServiceError(error, 'Test context')).toThrow('Resource not found');
    });

    it('should pass through UnauthorizedError', () => {
      const error = new UnauthorizedError('Not authorized');

      expect(() => handleServiceError(error, 'Test context')).toThrow(UnauthorizedError);
      expect(() => handleServiceError(error, 'Test context')).toThrow('Not authorized');
    });

    it('should wrap unknown errors with InternalServerError', () => {
      const error = new Error('Unknown error');

      expect(() => handleServiceError(error, 'Test context')).toThrow(InternalServerError);
      expect(() => handleServiceError(error, 'Test context')).toThrow(
        'Test context: Unknown error',
      );
    });

    it('should convert database unique constraint violations to ConflictError', () => {
      const error = Object.assign(new Error('Duplicate key'), { code: '23505' });

      expect(() => handleServiceError(error, 'Test context')).toThrow(ConflictError);
      expect(() => handleServiceError(error, 'Test context')).toThrow('Resource already exists');
    });
  });

  describe('sendSuccess', () => {
    it('should send a success response with data and message', () => {
      const { res, statusSpy, jsonSpy } = createMockResponse();

      sendSuccess(res, { id: 1 }, 'Success message');

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.OK);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: { id: 1 },
        error: null,
        message: 'Success message',
        statusCode: StatusCodes.OK,
      });
    });

    it('should send a success response with custom status code', () => {
      const { res, statusSpy, jsonSpy } = createMockResponse();

      sendSuccess(res, { id: 1 }, 'Created', StatusCodes.CREATED);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.CREATED);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: { id: 1 },
        error: null,
        message: 'Created',
        statusCode: StatusCodes.CREATED,
      });
    });

    it('should handle undefined data', () => {
      const { res, statusSpy, jsonSpy } = createMockResponse();

      sendSuccess(res, undefined, 'No content', StatusCodes.NO_CONTENT);

      expect(statusSpy).toHaveBeenCalledWith(StatusCodes.NO_CONTENT);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: undefined,
        error: null,
        message: 'No content',
        statusCode: StatusCodes.NO_CONTENT,
      });
    });
  });
});
