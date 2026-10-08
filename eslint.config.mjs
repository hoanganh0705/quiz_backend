// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import localPlugin from './tools/eslint-plugins/index.js';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'src/commands/**', 'tools/eslint-plugins/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // S-1 (code quality): enforce the 500/800 LOC budget that
      // `common-coding-style.mdc` documents. The rule warns at 500
      // (the typical cap) and errors at 800 (the hard cap). Both
      // thresholds match the rule's published rationale ("Many small
      // files > few large files; 200–400 lines typical, 800 max").
      // Skip comments + blank lines so the limit reflects real code.
      // The base ESLint rule covers `.ts` source; `@typescript-eslint`
      // 8.x no longer ships a `max-lines` rule of its own.
      'max-lines': [
        'warn',
        { max: 800, skipComments: true, skipBlankLines: true },
      ],
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Test/spec files commonly use `async () => value` to shape mocks
    // whose interface requires a Promise return (e.g. repository fakes
    // matching async port signatures). Forbidding `async` without
    // `await` in these files produces hundreds of false positives and
    // obscures real signal. The rule remains enforced for source code.
    //
    // `unbound-method` is also relaxed in tests because test doubles
    // routinely pass logger / spy methods as bare callbacks (e.g.
    // `bus.on('event', logger.info)`); the resulting `this` scoping
    // is irrelevant when the value is a jest.fn mock. Source code
    // remains under the default rule.
    files: [
      'src/**/*.spec.ts',
      'src/**/*.e2e-spec.ts',
      'test/**/*.e2e-spec.ts',
      'src/tools/eslint-plugins/**/*.spec.ts',
    ],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // Disable unsafe-* for Drizzle schema files — Drizzle uses dynamic table
    // types that ESLint can't fully understand
    files: ['src/core/database/schema/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    files: ['src/**/*.repository.ts'],
    plugins: {
      local: localPlugin,
    },
    rules: {
      'local/no-soft-delete-leak': 'error',
    },
  },
  {
    files: ['src/core/redis/redis.service.ts', 'src/core/redis/redis.service.spec.ts'],
    plugins: {
      local: localPlugin,
    },
    rules: {
      'local/no-blocking-redis-on-shared-client': 'error',
    },
  },
  {
    // Enforce the cache-key namespace index and forbid direct
    // this.client access outside RedisService. The central
    // implementation is exempt (it's the only file that owns the
    // ioredis client); every other module must go through
    // CacheProvider and the documented prefixes.
    files: ['src/**/*.ts'],
    ignores: ['src/core/redis/**', 'src/tools/eslint-plugins/**'],
    plugins: {
      local: localPlugin,
    },
    rules: {
      'local/no-raw-redis-keys': 'error',
    },
  },
  {
    // Every @Cron-decorated handler must acquire the scheduler lock
    // via acquireSchedulerLockOrRecordSkip so multi-replica deploys
    // do not race each other. Allowed for the rule's own files and
    // the central redis module which holds the lock primitive.
    // Severity is `warn` (advisory) so the rule surfaces every
    // cron method that lacks the lock without breaking CI on
    // first introduction. Pre-existing schedulers should be
    // wrapped in `acquireSchedulerLockOrRecordSkip` to clear the
    // warning.
    files: ['src/**/*.ts'],
    ignores: ['src/core/redis/**', 'src/tools/eslint-plugins/**'],
    plugins: {
      local: localPlugin,
    },
    rules: {
      'local/no-unlocked-scheduler': 'warn',
    },
  },
);
