import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false,
        },
      },
    ],
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/config/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Separate configs for unit vs integration runs
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup.ts'],
      clearMocks: true,
      restoreMocks: true,
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          { tsconfig: { esModuleInterop: true, allowSyntheticDefaultImports: true, strict: false } },
        ],
      },
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/tests/setup.ts'],
      testTimeout: 60000,
      clearMocks: true,
      restoreMocks: true,
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          { tsconfig: { esModuleInterop: true, allowSyntheticDefaultImports: true, strict: false } },
        ],
      },
    },
  ],
};

export default config;
