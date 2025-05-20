import { vi, afterEach } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { db } from '../src/config/database.config';

// Mock database
vi.mock('../src/config/database.config', () => ({
  db: mockDeep<typeof db>(),
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockImplementation(password => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn().mockImplementation((password, hash) => {
      return Promise.resolve(hash === `hashed_${password}` || hash === password);
    }),
  },
}));

// Mock jwt
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockImplementation(() => 'mock_token'),
    verify: vi.fn().mockImplementation((token, secret) => {
      if (token === 'invalid_token') throw new Error('Invalid token');
      return { userId: 1, email: 'test@example.com', role: 'user' };
    }),
  },
}));

// Mock environment variables
vi.mock('../src/config/env.config', () => ({
  default: {
    PORT: 3000,
    NODE_ENV: 'test',
    JWT_SECRET: 'test_secret',
    JWT_EXPIRES_IN: '1h',
    BCRYPT_SALT_ROUNDS: 10,
    DB_URL: 'postgres://test:test@localhost:5432/test',
  },
}));

// Reset mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});
