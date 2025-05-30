import { beforeAll, describe, expect, it, vi } from 'vitest';
import express, { Application } from 'express';
import request from 'supertest';
import authRoutes from '../../src/routes/auth.routes';
import { mockLoginRequest } from '../mocks';
import { StatusCodes } from 'http-status-codes';

// Mock the auth controller methods
vi.mock('../../src/controllers/auth.controller', () => {
  return {
    AuthController: vi.fn().mockImplementation(() => ({
      login: vi.fn((req, res) => {
        return res.status(StatusCodes.OK).json({
          success: true,
          message: 'Login successful',
          data: {
            user: {
              id: '00000000-0000-0000-0000-000000000001',
              username: req.body.username,
              role: 'Stock Manager',
            },
            token: 'mock_token',
          },
        });
      }),
      logout: vi.fn((req, res) => {
        return res.status(StatusCodes.OK).json({
          success: true,
          message: 'Logout successful',
          data: null,
        });
      }),
    })),
  };
});

// Mock validators
vi.mock('../../src/validators', () => ({
  validateGuestLogin: (req: any, res: any, next: () => any) => next(),
}));

// Mock authenticate middleware
vi.mock('../../src/middleware', () => ({
  authenticate: (req: any, res: any, next: () => any) => {
    // Add user to request as if authentication was successful
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'testuser',
      role: 'Stock Manager',
    };
    next();
  },
  rateLimiter: () => (req: any, res: any, next: () => any) => next(),
}));

describe('Auth Routes (Integration)', () => {
  let app: Application;
  let api: any;

  beforeAll(() => {
    // Create test Express application
    app = express();
    app.use(express.json());

    // Mount auth routes on /guest/auth
    app.use('/guest/auth', authRoutes);

    // Create supertest agent
    api = request(app);
  });

  describe('POST /guest/auth/login', () => {
    it('should login guest successfully', async () => {
      const response = await api
        .post('/guest/auth/login')
        .send(mockLoginRequest)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        success: true,
        message: 'Login successful',
        data: expect.objectContaining({
          user: expect.objectContaining({
            id: expect.any(String),
            username: mockLoginRequest.username,
            role: expect.any(String),
          }),
          token: expect.any(String),
        }),
      });
    });
  });

  describe('POST /guest/auth/logout', () => {
    it('should logout guest successfully', async () => {
      const response = await api
        .post('/guest/auth/logout')
        .set('Authorization', 'Bearer mock_token')
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({
        success: true,
        message: 'Logout successful',
        data: null,
      });
    });
  });
});
