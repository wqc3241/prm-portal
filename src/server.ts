import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import db from './config/database';
import { connectRedis, closeRedis } from './config/redis';
import { startScheduler, stopScheduler } from './jobs/scheduler';
import { closeAllQueues } from './jobs/queue';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function start() {
  // Validate critical env vars
  if (process.env.NODE_ENV === 'production') {
    const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
    for (const key of required) {
      if (!process.env[key]) {
        console.error(`Missing required environment variable: ${key}`);
        process.exit(1);
      }
    }
  }

  // Test database connection
  try {
    await db.raw('SELECT 1');
    console.log('[Database] Connected to PostgreSQL');
  } catch (err: any) {
    console.error('[Database] Connection failed:', err.message);
    process.exit(1);
  }

  // Connect Redis (non-blocking — rate limiting degrades gracefully)
  try {
    await connectRedis();
  } catch {
    console.warn('[Redis] Could not connect. Rate limiting will be disabled.');
  }

  const server = app.listen(PORT, () => {
    console.log(`[Server] PRM Portal API running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);

    // Start background job scheduler after server is listening
    try {
      startScheduler();
    } catch (err: any) {
      console.error('[Scheduler] Failed to start:', err.message);
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      console.log('[Server] HTTP server closed');

      // Stop scheduled jobs
      try {
        stopScheduler();
      } catch (err: any) {
        console.error('[Scheduler] Error stopping:', err.message);
      }

      // Close Bull queues
      try {
        await closeAllQueues();
        console.log('[Queue] All queues closed');
      } catch (err: any) {
        console.error('[Queue] Error closing queues:', err.message);
      }

      try {
        await db.destroy();
        console.log('[Database] Connection pool closed');
      } catch (err: any) {
        console.error('[Database] Error closing pool:', err.message);
      }

      try {
        await closeRedis();
        console.log('[Redis] Connection closed');
      } catch (err: any) {
        console.error('[Redis] Error closing connection:', err.message);
      }

      process.exit(0);
    });

    // Force shutdown after 5s
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
