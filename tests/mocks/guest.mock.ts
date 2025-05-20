// Mock guest data
export const mockGuests = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    firstName: 'John',
    lastName: 'Doe',
    location: 'Warehouse A',
    role: 'Stock Manager' as const,
    accessPeriod: '30 Days',
    username: 'john.doe1234',
    password: 'hashed_JoDo5678',
    status: 'Active' as const,
    credentialsViewed: false,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    firstName: 'Jane',
    lastName: 'Smith',
    location: 'Warehouse B',
    role: 'Store Keeper' as const,
    accessPeriod: '60 Days',
    username: 'jane.smith5678',
    password: 'hashed_JaSm9012',
    status: 'Active' as const,
    credentialsViewed: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
];

// Mock new guest data
export const mockNewGuest = {
  firstName: 'Robert',
  lastName: 'Johnson',
  location: 'Warehouse C',
  role: 'Stock Manager' as const,
  accessPeriod: '45 Days',
  username: 'robert.johnson1234',
  password: 'RoJo5678',
  generateCredentials: true,
};

// Mock guest credentials confirmation data
export const mockGuestCredentialsConfirmation = {
  username: 'robert.johnson1234',
  password: 'RoJo5678',
};
