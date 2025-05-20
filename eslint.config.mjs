// eslint.config.mjs
import eslint from '@eslint/js';
import prettier from 'eslint-plugin-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Global ignores
    ignores: [
      'dist/**/*', // Ignore the build output directory
      'node_modules/**/*', // Usually ignored by default
      '**/*.js', // Example: ignore JavaScript files if you only want to lint TS
      'drizzle.config.ts', // Omit Drizzle config
      'sonar-scanner.ts', // Omit Sonar scanner config
      'src/utils/encryption.util.ts', // Omit encryption.util.ts
      'test/**/*', // Omit all test files
    ],
  },
  eslint.configs.recommended,
  {
    // Configuration for TypeScript files
    files: ['src/**/*.ts', 'test/**/*.ts'], // Target .ts files in src and test
    extends: [
      ...tseslint.configs.recommended, // Recommended TypeScript rules
      // For stricter rules, you can use:
      // ...tseslint.configs.strict,
    ],
    plugins: {
      prettier: prettier,
    },
    rules: {
      // Prettier rules
      'prettier/prettier': 'error',
      // Allow unused variables that start with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
