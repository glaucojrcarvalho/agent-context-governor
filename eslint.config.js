import { defineConfig } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  // Type-aware rules scoped to TypeScript source files only
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Enforce explicit return types on exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Disallow floating promises (common source of silent failures in async code)
      '@typescript-eslint/no-floating-promises': 'error',
      // Disallow misused promises (e.g. passing async fn where sync is expected)
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
])
