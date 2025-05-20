# MSF API Primary Device

A backend API service for managing guest authentication and access in a primary device management system.

## Features

- Guest authentication with JWT
- Role-based access control
- API documentation with Swagger
- PostgreSQL database with Drizzle ORM
- Background job processing with BullMQ
- Comprehensive test coverage with Vitest
- SonarQube integration for code quality

## Tech Stack

- **Node.js & Express**: Backend framework
- **TypeScript**: Type-safe JavaScript
- **PostgreSQL**: Database
- **Drizzle ORM**: Database ORM
- **Redis**: Caching and job queue management
- **BullMQ**: Background job processing
- **JWT**: Authentication
- **Swagger**: API documentation
- **Winston**: Logging
- **Vitest**: Testing framework
- **SonarQube**: Code quality analysis
- **Docker**: Containerization

## Project Structure

```
src/
├── config/       # Environment and app configuration
├── controllers/  # Route controllers
├── database/     # Database setup and scripts
├── docs/         # Swagger documentation
├── jobs/         # Background jobs
├── middleware/   # Express middleware
├── models/       # Data models and schemas
├── routes/       # API routes
├── services/     # Business logic
├── types/        # TypeScript type definitions
├── utils/        # Utility functions
└── validators/   # Request validation
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd msf-api-primary-device
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   - Create a `.env` file based on provided example

4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push
   npm run seed   # Optional: Seed the database with initial data
   ```

### Running the Application

Development mode with hot reload:

```bash
npm run dev
```

Build and run in production mode:

```bash
npm run build
npm start
```

## API Documentation

The API documentation is available at `/api/docs` when the server is running. It provides detailed information about all endpoints, request/response formats, and authentication requirements.

### Authentication

The API uses JWT for authentication. To access protected endpoints:

1. Log in using the `/auth/login` endpoint with valid guest credentials
2. Include the returned token in the Authorization header: `Bearer <token>`

## Testing

Run all tests:

```bash
npm test
```

Run tests with coverage report:

```bash
npm run test:coverage
```

Interactive test UI:

```bash
npm run test:ui
```

## Code Quality

Run linting:

```bash
npm run lint
```

Fix linting issues:

```bash
npm run lint:fix
```

Format code:

```bash
npm run format
```

Run SonarQube analysis:

```bash
npm run sonar
```

## Database Management

Generate migration files:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:push
```

Drop all tables:

```bash
npm run db:drop
```

## Deployment

The application can be deployed using Docker:

```bash
docker-compose up -d
```

This will start the API server along with PostgreSQL and Redis instances.

## License

[MIT](LICENSE)
