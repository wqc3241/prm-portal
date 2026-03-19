/**
 * Global test setup — runs before each test file.
 *
 * Unit tests: mocks are applied per-test via jest.mock().
 * Integration tests: require real DB + Redis. Those tests import
 * this file, which sets environment variables from .env.test if present.
 */

// Load test environment variables before any module is imported
import * as dotenv from 'dotenv';
import * as path from 'path';

// Try .env.test first, fall back to .env
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Ensure a test-specific DB is used so integration tests never pollute production
if (!process.env.DB_NAME) {
  process.env.DB_NAME = 'prm_portal_test';
}

// Shorten bcrypt rounds for unit tests to keep them fast
process.env.BCRYPT_ROUNDS = '1';

// Predictable JWT secrets for test token generation
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-jwt-secret-minimum-32-chars-here!!';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-minimum-32-chars!!';

// Suppress console output during tests unless DEBUG_TESTS is set
if (!process.env.DEBUG_TESTS) {
  global.console.log = jest.fn();
  global.console.info = jest.fn();
  global.console.warn = jest.fn();
  // Keep console.error visible so test failures are easy to diagnose
}

// Increase default timeout for CI environments
jest.setTimeout(30000);
