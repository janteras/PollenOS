/**
 * Logger module for Pollen Trading Bot
 * Provides consistent logging functionality throughout the application
 */
const winston = require('winston');

// Create a custom logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.colorize(),
    winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    // Console transport
    new winston.transports.Console(),
    // File transport for all logs
    new winston.transports.File({ 
      filename: 'logs/pollen-bot.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for error logs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ]
});

// Method to change log level dynamically
function setLevel(level) {
  logger.level = level;
  logger.info(`Log level set to: ${level}`);
}

// Export logger functions
module.exports = {
  debug: (message, meta) => logger.debug(message, meta),
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => {
    // Add timestamp and context for critical errors
    const errorContext = {
      timestamp: new Date().toISOString(),
      ...meta,
      stack: meta?.stack || new Error().stack
    };
    logger.error(message, errorContext);
  },
  critical: (message, meta) => {
    // Special critical error logger
    const criticalContext = {
      level: 'CRITICAL',
      timestamp: new Date().toISOString(),
      ...meta
    };
    logger.error(`[CRITICAL] ${message}`, criticalContext);
  },
  setLevel
};
