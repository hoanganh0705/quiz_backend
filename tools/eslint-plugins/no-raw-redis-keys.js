// @ts-check
'use strict';

/**
 * Forbid Redis cache keys that bypass the namespace index and forbid
 * direct access to the underlying ioredis client outside the central
 * RedisService.
 *
 * Background
 * ----------
 * Every Redis key the application writes is documented in the
 * namespace index on RedisService. Anything outside that index is
 * invisible to operators, invalidation handlers, and the migration
 * runbook. The audit found two distinct ways new keys escaped that
 * index:
 *
 *   1. Module authors called `cache.set('some-key', ...)` with a
 *      hard-coded string that did not start with any documented
 *      prefix. The key would write successfully and become a silent
 *      addition to Redis that no tooling would find.
 *
 *   2. Module authors reached into RedisService.client directly
 *      to issue set / get / del calls. Those bypass the
 *      circuit breaker, the tracing wrapper, and the key-prefix
 *      validation entirely.
 *
 * Rule scope
 * ----------
 * The rule is enabled for src files excluding src/core/redis (the
 * central RedisService is exempt) and the rule's own spec. The
 * exclusion lets the central RedisService use any ioredis primitive
 * it needs, while every other module is forced through CacheProvider
 * and the namespace index.
 *
 * What is checked
 * ---------------
 *   - Literal string keys passed to cache.set / cache.get / cache.del
 *     must start with one of the prefixes in CACHE_KEY_PREFIXES.
 *     Constant references and template literals are out of scope
 *     (the rule cannot statically resolve them); reviewers must
 *     catch those by inspection.
 *   - Direct this.client.<method> calls (set, get, del, unlink,
 *     lpush, eval, hset, zadd, publish, ...) are reported when they
 *     appear outside src/core/redis. The lock / advisory /
 *     subscription helpers are also flagged.
 */
const CACHE_KEY_PREFIXES = [
  'achievement:cache:',
  'auth:rate_limit:',
  'auth:refresh_reuse:',
  'auth:session:invalidation',
  'bookmark:collection:',
  'comment:event_retry_queue',
  'comment:event_dead_letter',
  'comment:event_retry_poll_lock',
  'lb:',
  'pos:',
  'total:',
  'ranking:version:',
  'notif:prefs:',
  'notif:analytics:',
  'quiz:list:',
  'quiz:stats:',
  'ref:v1:',
  'socket-connection:',
  'social:counts:',
  'tag:ranking:',
  'throttler:',
  'tournament:',
  'user:profile-bundle:',
];

const CACHE_METHODS = new Set(['set', 'get', 'del']);

const DIRECT_CLIENT_METHODS = new Set([
  'set',
  'get',
  'del',
  'unlink',
  'lpush',
  'rpush',
  'lpop',
  'rpop',
  'lrange',
  'ltrim',
  'eval',
  'evalsha',
  'hset',
  'hget',
  'hgetall',
  'hdel',
  'sadd',
  'srem',
  'smembers',
  'zadd',
  'zrange',
  'zrangebyscore',
  'zrem',
  'incr',
  'incrby',
  'decr',
  'decrby',
  'expire',
  'ttl',
  'pttl',
  'publish',
  'subscribe',
  'unsubscribe',
  'setnx',
  'getdel',
  'ping',
  'exists',
  'keys',
  'scan',
]);

const REDIS_SERVICE_PATH = /src\/core\/redis\/redis\.service(\.spec)?\.ts$/;

function isKnownPrefix(key) {
  if (typeof key !== 'string' || key.length === 0) return false;
  for (const prefix of CACHE_KEY_PREFIXES) {
    if (key === prefix.slice(0, -1)) return true;
    if (key.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Returns true when the node is a cache.<method>(...) CallExpression
 * with the first argument a string literal.
 * @param {import('estree').Node} node
 */
function getCacheLiteralKeyCall(node) {
  if (!node || node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression') return null;
  if (callee.property.type !== 'Identifier') return null;
  const method = callee.property.name.toLowerCase();
  if (!CACHE_METHODS.has(method)) return null;
  const receiverName = getReceiverIdentifierName(callee.object);
  if (!receiverName || !/cache/i.test(receiverName)) return null;
  const firstArg = node.arguments[0];
  if (!firstArg || firstArg.type !== 'Literal' || typeof firstArg.value !== 'string') return null;
  return { method, key: firstArg.value, argNode: firstArg };
}

/**
 * Extract the leaf identifier name from a (possibly chained) receiver
 * expression. For `this.cache.get(...)` the receiver is
 * `this.cache` (a MemberExpression); we recurse to the rightmost
 * member so we get `'cache'`. For `cache.get(...)` we already have
 * an Identifier. Returns null if no identifier is reachable.
 * @param {import('estree').Node | null | undefined} node
 */
function getReceiverIdentifierName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    return getReceiverIdentifierName(node.property);
  }
  return null;
}

/**
 * Returns true when the node is `this.client.<method>(...)` with
 * `<method>` in DIRECT_CLIENT_METHODS.
 * @param {import('estree').Node} node
 */
function getDirectClientCall(node) {
  if (!node || node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression') return null;
  if (callee.object.type !== 'MemberExpression') return null;
  const target = callee.object;
  if (target.object.type !== 'ThisExpression') return null;
  if (target.property.type !== 'Identifier' || target.property.name !== 'client') return null;
  if (callee.property.type !== 'Identifier') return null;
  if (!DIRECT_CLIENT_METHODS.has(callee.property.name.toLowerCase())) return null;
  return { method: callee.property.name, node };
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    name: 'no-raw-redis-keys',
    type: 'problem',
    docs: {
      description:
        'Disallow Redis cache keys that do not start with a documented namespace prefix, and forbid direct this.client.* access outside RedisService. New cache keys MUST go through CacheProvider and be added to the namespace index on RedisService.',
      recommended: 'error',
      requiresTypeChecking: false,
    },
    messages: {
      unknownCacheKey:
        'Cache key `{{ key }}` does not match any documented namespace prefix. Add the prefix to the `no-raw-redis-keys` rule and to the namespace index on `RedisService`.',
      directClientCall:
        'Direct `this.client.{{ method }}(...)` access is forbidden outside `RedisService`. Use the `CacheProvider` / `PubSubProvider` ports so the call goes through the circuit breaker and the tracing wrapper.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? '';
    if (REDIS_SERVICE_PATH.test(filename)) return {};
    if (/no-raw-redis-keys/.test(filename)) return {};

    return {
      CallExpression(node) {
        const direct = getDirectClientCall(node);
        if (direct) {
          context.report({
            node: direct.node,
            messageId: 'directClientCall',
            data: { method: direct.method },
          });
          return;
        }

        const literal = getCacheLiteralKeyCall(node);
        if (!literal) return;
        if (isKnownPrefix(literal.key)) return;

        context.report({
          node: literal.argNode,
          messageId: 'unknownCacheKey',
          data: { key: literal.key },
        });
      },
    };
  },
  // Exposed for unit tests.
  __internals: {
    CACHE_KEY_PREFIXES,
    DIRECT_CLIENT_METHODS,
    CACHE_METHODS,
    isKnownPrefix,
    getCacheLiteralKeyCall,
    getDirectClientCall,
    getReceiverIdentifierName,
  },
};
