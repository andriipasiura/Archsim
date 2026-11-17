import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist', '**/coverage', 'apps/api/src/generated']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message: 'Import other features through their index.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: [
      'apps/api/**/*.ts',
      'packages/**/*.ts',
      '*.{js,ts}',
      'apps/*/*.{js,ts}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/api/**/*.spec.ts', 'apps/api/**/*.e2e-spec.ts'],
    languageOptions: { globals: globals.vitest },
  },
  prettier,
]);
