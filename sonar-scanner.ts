/* eslint-disable @typescript-eslint/no-var-requires */
// This import method works with both ESM and CommonJS modules
import * as fs from 'fs';
import scanner from 'sonarqube-scanner';

// Read package.json
const packageJsonContent = fs.readFileSync('./package.json', 'utf8');
const packageJson = JSON.parse(packageJsonContent);

// Read environment variables with defaults
const sonarUrl = process.env.SONAR_SERVER_URL ?? 'http://localhost:9000';

scanner(
  {
    serverUrl: process.env.SONAR_SERVER_URL ?? 'http://localhost:9000',
    options: {
      'sonar.projectKey': packageJson.name,
      'sonar.projectName': packageJson.name,
      'sonar.projectDescription': packageJson.description,
      'sonar.projectVersion': packageJson.version,
      'sonar.login': process.env.SONAR_LOGIN ?? 'admin',
      'sonar.password': process.env.SONAR_PASSWORD ?? 'admin@123',
      'sonar.sources': 'src',
      'sonar.tests': 'tests', // or 'tests' if tests are separate
      'sonar.test.inclusions': '**/*.{test,spec}.{ts,js,tsx,jsx}',
      'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
      'sonar.typescript.lcov.reportPaths': 'coverage/lcov.info',
      'sonar.testExecutionReportPaths': 'coverage/test-report.xml',
      'sonar.coverage.exclusions': [
        'test/**',
        'src/database/scripts/**',
        'src/index.ts',
        'src/utils/*.ts',
        'src/docs/**',
        'src/middleware/rateLimiter.middleware.ts',
        'src/**/index.ts',
        'src/validators/*.ts',
        'src/models/**',
        'src/config/**',
      ].join(','),
      'sonar.exclusions':
        'node_modules/**,coverage/**,dist/**,tests/**,jest.config.ts,drizzle.config.ts',
    },
  },
  () => process.exit(),
);
