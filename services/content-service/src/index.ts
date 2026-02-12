/**
 * Content Service - Main Application Entry Point
 *
 * This service manages content templates, items, media assets,
 * approval workflows, and versioning.
 * Part of the Auto Claude Marketing Hub microservices architecture.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { connectDatabase } from './db/connection.js';
import { connectRedis } from './db/redis.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authMiddleware } from './middleware/auth.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { setupMetrics } from './utils/prometheus.js';
import { setupTracing } from './utils/tracing.js';

// Import routes
import templateRoutes from './routes/templates.js';
import contentRoutes from './routes/content.js';
import mediaRoutes from './routes/media.js';
import approvalRoutes from './routes/approvals.js';
import healthRoutes from './routes/health.js';

// Create Express app
const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origins,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Compression
app.use(compression());

// Request logging
if (config.env !== 'test') {
  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
}

// Metrics middleware
app.use(metricsMiddleware);

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// Auth middleware for protected routes
app.use('/api', authMiddleware);

// Request ID and logging
app.use(requestLogger);

// API routes
app.use('/api/templates', templateRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/approvals', approvalRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Metrics endpoint
setupMetrics(app);

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close database connections
  await (await connectDatabase()).close();
  logger.info('MongoDB connection closed');

  (await connectRedis()).quit();
  logger.info('Redis connection closed');

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Setup OpenTelemetry tracing (if enabled)
    if (config.tracing.enabled) {
      await setupTracing();
      logger.info('OpenTelemetry tracing enabled');
    }

    // Connect to MongoDB
    await connectDatabase();
    logger.info('MongoDB connected');

    // Connect to Redis
    await connectRedis();
    logger.info('Redis connected');

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`Content Service listening on port ${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server only if not in test mode
if (config.env !== 'test') {
  startServer();
}

export { app, httpServer };
