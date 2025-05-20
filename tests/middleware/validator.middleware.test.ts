import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { validate } from '../../src/middleware/validator.middleware';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/test-utils';
import { logger } from '../../src/utils/logger';
import { ValidationError } from '../../src/utils/error.util';

// Mock the logger
vi.mock('../../src/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('Validator Middleware', () => {
  let req: Request;
  let res: Response;
  let next: ReturnType<typeof vi.fn>;
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

  describe('validate', () => {
    it('should call next() when validation passes on body', () => {
      // Create a schema that requires email and password
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
      });

      // Set up request body
      req.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      // Call the middleware
      validate(schema)(req, res, next);

      // Expect next to be called with no arguments
      expect(next).toHaveBeenCalledWith();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next() when validation passes on query params', () => {
      // Create a schema for query parameters
      const schema = z.object({
        page: z.string().regex(/^\d+$/),
        limit: z.string().regex(/^\d+$/),
      });

      // Set up request query
      req.query = {
        page: '1',
        limit: '10',
      };

      // Call the middleware with query source
      validate(schema, 'query')(req, res, next);

      // Expect next to be called with no arguments
      expect(next).toHaveBeenCalledWith();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should call next() when validation passes on URL params', () => {
      // Create a schema for URL parameters
      const schema = z.object({
        id: z.string().regex(/^\d+$/),
      });

      // Set up request params
      req.params = {
        id: '123',
      };

      // Call the middleware with params source
      validate(schema, 'params')(req, res, next);

      // Expect next to be called with no arguments
      expect(next).toHaveBeenCalledWith();
      expect(jsonSpy).not.toHaveBeenCalled();
    });

    it('should return 400 when validation fails', () => {
      // Create a schema that requires email and password
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
      });

      // Set up invalid request body
      req.body = {
        email: 'not-an-email',
        password: 'short',
      };

      // Call the middleware
      validate(schema)(req, res, next);

      // Expect next to be called with ValidationError
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(next.mock.calls[0][0].message).toMatch(
        /email: Invalid email, password: String must contain at least 6 character/,
      );
    });

    it('should format validation errors correctly', () => {
      // Create a schema with multiple potential errors
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        age: z.number().int().positive(),
      });

      // Set up invalid request body
      req.body = {
        email: 'not-an-email',
        password: 'short',
        age: -5,
      };

      // Call the middleware
      validate(schema)(req, res, next);

      // Verify error is passed to next
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const errorMsg = next.mock.calls[0][0].message;
      expect(errorMsg).toContain('email:');
      expect(errorMsg).toContain('password:');
      expect(errorMsg).toContain('age:');
    });

    it('should call next with error for non-Zod errors', () => {
      // Create a schema
      const schema = z.object({
        test: z.string(),
      });

      // Mock the schema.parse to throw a non-Zod error
      vi.spyOn(schema, 'parse').mockImplementation(() => {
        throw new Error('Some unexpected error');
      });

      // Set up request body
      req.body = { test: 'value' };

      // Call the middleware
      validate(schema)(req, res, next);

      // Expect next to be called with the error
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(jsonSpy).not.toHaveBeenCalled();
    });
  });
});
