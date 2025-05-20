import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Enable global test utilities
    globals: true,
    // Environment setup
    environment: 'node',
    // Include all test files
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Configure mock usage
    mockReset: true,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/database/scripts/**',
        'src/types/**',
        'src/index.ts',
        'src/config/env.ts',
        'src/utils/*.ts',
        'src/validators/*.ts',
        'src/docs/**',
        'src/models/**',
        'src/config/**',
        'src/middleware/rateLimiter.middleware.ts',
      ],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
    reporters: ['default', ['vitest-sonar-reporter', { outputFile: 'coverage/test-report.xml' }]],
    // Resolver for module resolution
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
