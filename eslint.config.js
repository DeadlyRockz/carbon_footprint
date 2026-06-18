/**
 * ESLint flat config.
 *
 * Linting catches correctness problems (undeclared names, unused bindings,
 * unreachable code); Prettier owns formatting. `eslint-config-prettier` is
 * applied last to switch off any stylistic rules that would fight Prettier.
 */

import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  // The bundle is generated; never lint it.
  { ignores: ['app.bundle.js', 'node_modules/**'] },

  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // Browser ES modules.
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },

  // Service worker.
  {
    files: ['sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },

  // Node tooling and tests.
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  prettier,
];
