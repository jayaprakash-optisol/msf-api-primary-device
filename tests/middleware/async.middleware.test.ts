import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { asyncHandler } from '../../src/middleware/async.middleware';
import { createMockRequest, createMockResponse, createMockNext } from '../utils/test-utils';

describe('Async Middleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest() as Request;
    const mockRes = createMockResponse();
    res = mockRes.res;
    next = createMockNext();
  });

  it('should pass the result of a successful async function', async () => {
    // Create a mock async function that resolves
    const asyncFn = vi.fn().mockResolvedValue({ success: true });

    // Wrap the function with asyncHandler
    const wrappedFn = asyncHandler(asyncFn);

    // Call the wrapped function
    wrappedFn(req, res, next);

    // Wait for promises to resolve
    await vi.waitFor(() => {
      // Verify the original function was called with the right arguments
      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      // Verify next was not called (no error)
      expect(next).not.toHaveBeenCalled();
    });
  });

  it('should pass errors to the next middleware', async () => {
    // Create a mock error
    const testError = new Error('Test error');

    // Create a mock async function that rejects
    const asyncFn = vi.fn().mockRejectedValue(testError);

    // Wrap the function with asyncHandler
    const wrappedFn = asyncHandler(asyncFn);

    // Call the wrapped function
    wrappedFn(req, res, next);

    // Wait for promises to resolve
    await vi.waitFor(() => {
      // Verify the original function was called with the right arguments
      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      // Verify next was called with the error
      expect(next).toHaveBeenCalledWith(testError);
    });
  });

  it('should work with synchronous functions that return a promise', async () => {
    // Create a synchronous function that returns a promise
    const syncFn = vi.fn().mockImplementation((req, res, next) => {
      return Promise.resolve({ data: 'success' });
    });

    // Wrap the function with asyncHandler
    const wrappedFn = asyncHandler(syncFn);

    // Call the wrapped function
    wrappedFn(req, res, next);

    // Wait for promises to resolve
    await vi.waitFor(() => {
      // Verify the original function was called with the right arguments
      expect(syncFn).toHaveBeenCalledWith(req, res, next);
      // Verify next was not called (no error)
      expect(next).not.toHaveBeenCalled();
    });
  });

  it('should pass custom request/response types correctly', async () => {
    // Create an interface extending Request
    interface CustomRequest extends Request {
      customField: string;
    }

    // Create an interface extending Response
    interface CustomResponse extends Response {
      customMethod: () => void;
    }

    // Create custom objects
    const customReq = { ...req, customField: 'test' } as unknown as CustomRequest;
    const customRes = {
      ...res,
      customMethod: vi.fn(),
    } as unknown as CustomResponse;

    // Create a typed async function
    const typedAsyncFn = vi
      .fn()
      .mockImplementation((req: CustomRequest, res: CustomResponse, next: NextFunction) => {
        // Access the custom properties to verify types work
        const field = req.customField;
        res.customMethod();
        return Promise.resolve({ field });
      });

    // Wrap with correct generic types
    const wrappedFn = asyncHandler<CustomRequest, CustomResponse>(typedAsyncFn);

    // Call the wrapped function
    wrappedFn(customReq, customRes, next);

    // Wait for promises to resolve
    await vi.waitFor(() => {
      // Verify function was called with correct arguments
      expect(typedAsyncFn).toHaveBeenCalledWith(customReq, customRes, next);
      // Verify custom method was called
      expect(customRes.customMethod).toHaveBeenCalled();
      // Verify next wasn't called
      expect(next).not.toHaveBeenCalled();
    });
  });
});
