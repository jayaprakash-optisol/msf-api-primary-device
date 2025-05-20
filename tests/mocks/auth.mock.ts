// Mock jwt payload
export const mockJwtPayload = {
  guestId: '00000000-0000-0000-0000-000000000001',
  username: 'john.doe1234',
  role: 'Stock Manager' as const,
};

// Mock tokens
export const mockToken = 'mock_token';
export const invalidToken = 'invalid_token';

// Mock auth headers
export const mockAuthHeaders = {
  Authorization: `Bearer ${mockToken}`,
};

// Mock requests
export const mockLoginRequest = {
  username: 'john.doe1234',
  password: 'Password123!',
};
