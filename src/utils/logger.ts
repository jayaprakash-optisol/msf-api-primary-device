import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Initialize configuration directly from process.env to avoid circular dependencies
const logFilePath = process.env.LOG_FILE_PATH ?? 'logs/app.log';
const logLevel = process.env.LOG_LEVEL ?? 'info';
const nodeEnv = process.env.NODE_ENV ?? 'development';

// Ensure log directory exists
const logDir = path.dirname(logFilePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Clean console format
const consoleFormat = winston.format.printf(({ level, message, timestamp }) => {
  const msg = String(message).trim();
  return `${timestamp} ${level}: ${msg}`;
});

// File format (JSON for machine readability)
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create the logger
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { service: 'express-api' },
  transports: [
    // Write logs to file
    new winston.transports.File({
      filename: logFilePath,
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      level: logLevel,
    }),
    // Error logs
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

// Add console transport for non-production environments
if (nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.colorize(),
        winston.format.errors({ stack: false }), // No stack traces in console
        consoleFormat,
      ),
    }),
  );
}

// Create a stream object for Morgan
export const stream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

/**
 * Update log level for file transports
 */
const updateFileTransportsLogLevel = (
  transports: winston.transport[],
  oldLevel: string,
  newLevel: string,
): void => {
  transports.forEach(transport => {
    if (transport instanceof winston.transports.File && transport.level === oldLevel) {
      transport.level = newLevel;
    }
  });
};

/**
 * Ensure log directory exists
 */
const ensureLogDirectory = (dirPath: string): void => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Remove existing file transports
 */
const removeFileTransports = (
  logger: winston.Logger,
  oldLogPath: string,
  oldLogDir: string,
): void => {
  logger.transports.forEach((transport, index) => {
    if (transport instanceof winston.transports.File) {
      if (
        transport.filename === oldLogPath ||
        transport.filename === path.join(oldLogDir, 'error.log')
      ) {
        logger.transports.splice(index, 1);
      }
    }
  });
};

/**
 * Create new file transport
 */
const createFileTransport = (
  filename: string,
  level: string,
  isErrorLog = false,
): winston.transport => {
  return new winston.transports.File({
    filename,
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    level: isErrorLog ? 'error' : level,
  });
};

/**
 * Update logger configuration with values from loaded environment
 * Call this after the environment has been fully initialized
 */
export const updateLoggerConfig = (configLogLevel: string, configLogFilePath: string): void => {
  // Update log level if changed
  if (configLogLevel !== logLevel) {
    logger.level = configLogLevel;
    updateFileTransportsLogLevel(logger.transports, logLevel, configLogLevel);
    console.log(`Logger level updated to ${configLogLevel}`);
  }

  // Update file transports if path changed
  if (configLogFilePath !== logFilePath) {
    const newLogDir = path.dirname(configLogFilePath);
    ensureLogDirectory(newLogDir);

    // Remove old transports and add new ones
    removeFileTransports(logger, logFilePath, logDir);

    logger.add(createFileTransport(configLogFilePath, configLogLevel));
    logger.add(createFileTransport(path.join(newLogDir, 'error.log'), configLogLevel, true));

    console.log(`Logger file path updated to ${configLogFilePath}`);
  }
};
