import http from 'http';
import path from 'path';

import compression from 'compression';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import morgan from 'morgan';

import { closePool, initDatabaseConnection, testConnection } from './config/database.config';
import env from './config/env.config';
import { initRedisClient } from './config/redis.config';
import swaggerSpec from './docs/swagger';
import {
  cacheControl,
  contentSecurityPolicy,
  corsOptions,
  frameGuard,
  hsts,
  noSniff,
  rateLimiter,
  xssFilter,
} from './middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import routes from './routes';
import { closeRedisConnections } from './utils/redis.util';
import { logger, updateLoggerConfig, stream } from './utils';

// Create Express application
export const app: Application = express();

export async function configureApp(): Promise<void> {
  // Custom HTTP request logging middleware

  // Update logger with loaded environment config
  updateLoggerConfig(env.LOG_LEVEL, env.LOG_FILE_PATH);

  // Initialize database with loaded environment variables
  await initDatabaseConnection();
  await testConnection();

  // Initialize Redis client
  initRedisClient();

  // BullMQ will connect to Redis lazily when needed

  // Security middleware
  app.use(helmet());

  // CORS with custom options
  app.use(cors(corsOptions));

  // Additional security headers
  app.use(contentSecurityPolicy);
  app.use(noSniff);
  app.use(xssFilter);
  app.use(frameGuard);
  app.use(hsts);
  app.use(cacheControl);

  // Request parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Compression
  app.use(compression());

  // Logging
  if (env.NODE_ENV === 'production') {
    app.use(morgan('combined', { stream }));
  } else {
    // Simple, clean log format for development
    app.use(
      morgan(':method :url :status :response-time[0]ms', {
        stream,
        skip: req => req.url === '/health',
      }),
    );
  }

  // Apply rate limiter to API routes
  app.use(`${env.API_PREFIX}`, rateLimiter());

  // Configure web API routes with versioning
  app.use(env.API_PREFIX, routes);

  // Health check endpoint (no rate limiting)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK' });
  });

  // Swagger documentation (no rate limiting)
  app.use(`/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Serve static files from the correct public directory
  app.use(express.static(path.resolve(__dirname, '../public')));

  // Serve .well-known directory with correct content type
  app.use(
    '/.well-known',
    express.static(path.resolve(__dirname, '../.well-known'), {
      setHeaders: (res, path) => {
        if (path.endsWith('apple-app-site-association')) {
          res.setHeader('Content-Type', 'application/json');
        }
      },
    }),
  );

  // Expose Swagger JSON (no rate limiting)
  app.get(`/api-docs.json`, (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);
}

async function startServer(): Promise<void> {
  try {
    await configureApp();
    const server = http.createServer(app);

    server.listen(env.PORT, () => {
      logger.info(`✅ Server is running on port ${env.PORT}`);
      logger.info(`✅ API Documentation available at http://localhost:${env.PORT}/api-docs`);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      await closePool();
      await closeRedisConnections();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export startServer function for programmatic usage
export { startServer };

// Start server only if this file is run directly (not when imported as a module)
if (require.main === module) {
  startServer();
}
