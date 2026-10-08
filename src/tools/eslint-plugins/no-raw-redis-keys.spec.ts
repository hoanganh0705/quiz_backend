import { RuleTester } from 'eslint';
import rule from '../../../tools/eslint-plugins/no-raw-redis-keys';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

const sample = (
  code: string,
  filename = '/repo/src/modules/sample.ts',
): { code: string; filename: string } => ({
  code,
  filename,
});

describe('no-raw-redis-keys', () => {
  describe('literal cache key validation', () => {
    ruleTester.run('no-raw-redis-keys', rule, {
      valid: [
        sample(`cache.set('bookmark:collection:col-1:analytics:user:u1', '{}', 1000);`),
        sample(`cache.get('user:profile-bundle:v1:u1:default');`),
        sample(`cache.del('achievement:cache:badges');`),
        sample(`cache.set('throttler:default:user-1', '1', 60_000);`),
        sample(`cache.del('quiz:stats:v1:quiz-1');`),
        sample(`cache.set('tag:ranking:popular:10:v3', '[]', 60_000);`),
        sample(`this.cache.set('notif:prefs:user-1', '{}', 60_000);`),
        sample(`const key = buildKey(id);\nawait this.cache.del(key);`, '/repo/src/modules/x.ts'),
        sample(
          `const ANALYTICS_KEY = 'notif:analytics:platform';\nawait this.cache.set(ANALYTICS_KEY, '{}', 60_000);`,
        ),
        sample(
          `await this.cache.set(\`user:profile-bundle:v1:\${userId}:\${hash}\`, '{}', 60_000);`,
        ),
      ],
      invalid: [
        {
          ...sample(`cache.set('foo:bar:1', '{}', 60_000);`),
          errors: [{ messageId: 'unknownCacheKey', data: { key: 'foo:bar:1' } }],
        },
        {
          ...sample(`this.cache.get('totally_unknown:key');`),
          errors: [{ messageId: 'unknownCacheKey', data: { key: 'totally_unknown:key' } }],
        },
        {
          ...sample(`cache.del('analytics:v2:foo');`),
          errors: [{ messageId: 'unknownCacheKey', data: { key: 'analytics:v2:foo' } }],
        },
      ],
    });
  });

  describe('direct this.client.<method> calls are forbidden outside RedisService', () => {
    ruleTester.run('no-raw-redis-keys', rule, {
      valid: [],
      invalid: [
        {
          ...sample(`async function write() { await this.client.set('quiz:foo', '1'); }`),
          errors: [{ messageId: 'directClientCall', data: { method: 'set' } }],
        },
        {
          ...sample(`async function read() { return this.client.get('quiz:foo'); }`),
          errors: [{ messageId: 'directClientCall', data: { method: 'get' } }],
        },
        {
          ...sample(`async function drop() { await this.client.unlink('quiz:foo'); }`),
          errors: [{ messageId: 'directClientCall', data: { method: 'unlink' } }],
        },
        {
          ...sample(`async function script() { await this.client.eval('return 1', 0); }`),
          errors: [{ messageId: 'directClientCall', data: { method: 'eval' } }],
        },
      ],
    });
  });

  describe('RedisService itself is exempt', () => {
    ruleTester.run('no-raw-redis-keys', rule, {
      valid: [
        sample(
          `async function write() { await this.client.set('quiz:foo', '1'); }`,
          '/repo/src/core/redis/redis.service.ts',
        ),
        sample(
          `async function read() { return this.client.get('cache:key'); }`,
          '/repo/src/core/redis/redis.service.spec.ts',
        ),
      ],
      invalid: [],
    });
  });
});
