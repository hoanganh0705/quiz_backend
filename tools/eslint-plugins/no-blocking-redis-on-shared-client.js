// @ts-check
'use strict';

/**
 * Forbid blocking Redis commands on the shared `RedisService.client`.
 *
 * Background
 * ----------
 * `RedisService.client` is a single ioredis connection that is shared
 * across every `CacheProvider`/`PubSubProvider` call. Blocking commands
 * (`BLPOP`, `BRPOP`, `BLMPOP`, `WAIT`, etc.) tie up that connection and
 * stall every other Redis user on the same instance.
 *
 * Callers that genuinely need blocking semantics must obtain a
 * dedicated client through `RedisService.createSubscriber()` /
 * `createClient()` and own the lifecycle of that client themselves.
 *
 * Rule scope
 * ----------
 * The rule is enabled for `src/core/redis/<file>.ts`. Inside
 * `RedisService` itself, calls from `createClient()` (and helpers it
 * invokes) are exempt — those calls allocate a fresh connection.
 */
const BLOCKING_REDIS_METHODS = new Set([
  'BLPOP',
  'BRPOP',
  'BLMPOP',
  'BLMOVE',
  'BRPOPLPUSH',
  'BZPOPMAX',
  'BZPOPMIN',
  'BZMPOP',
  'WAIT',
  'WAITAOF',
  'XREAD',
  'XREADGROUP',
  'CLIENT',
]);

/**
 * Returns true when the given CallExpression is `this.client.<method>(...)`
 * with `<method>` in BLOCKING_REDIS_METHODS.
 * @param {import('estree').Node} node
 */
function isBlockingSharedClientCall(node) {
  if (!node || node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (!callee || callee.type !== 'MemberExpression') return false;
  if (callee.object.type !== 'MemberExpression') return false;
  const target = callee.object;
  if (target.object.type !== 'ThisExpression') return false;
  if (target.property.type !== 'Identifier' || target.property.name !== 'client') return false;
  if (callee.property.type !== 'Identifier') return false;
  return BLOCKING_REDIS_METHODS.has(callee.property.name);
}

/**
 * Walk up the AST from `node` to find the enclosing function and report
 * its name (if any) and whether the function is `createClient`.
 * @param {import('estree').Node} startNode
 */
function getEnclosingFunctionName(startNode) {
  let cur = startNode;
  while (cur) {
    if (
      cur.type === 'FunctionDeclaration' ||
      cur.type === 'FunctionExpression' ||
      cur.type === 'ArrowFunctionExpression'
    ) {
      if (cur.type === 'FunctionDeclaration' && cur.id && cur.id.name) {
        return cur.id.name;
      }
      const parent = cur.parent;
      if (
        parent &&
        parent.type === 'MethodDefinition' &&
        parent.key &&
        parent.key.type === 'Identifier'
      ) {
        return parent.key.name;
      }
      if (
        parent &&
        parent.type === 'Property' &&
        parent.key &&
        parent.key.type === 'Identifier'
      ) {
        return parent.key.name;
      }
      return null;
    }
    cur = cur.parent;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    name: 'no-blocking-redis-on-shared-client',
    type: 'problem',
    docs: {
      description:
        'Disallow blocking Redis commands (BLPOP, BRPOP, BLMPOP, WAIT, XREAD, ...) on the shared RedisService.client. Use createClient() to obtain a dedicated connection.',
      recommended: 'error',
      requiresTypeChecking: false,
    },
    messages: {
      blockingOnSharedClient:
        'Blocking Redis command `{{ method }}` MUST NOT be invoked on the shared `this.client`. Obtain a dedicated connection via `createSubscriber()` / `createClient()` instead. Blocking the shared client stalls every other Redis caller on this instance.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? '';

    // Only enforce inside the RedisService file (and its spec).
    // createClient() is the dedicated escape hatch.
    const isRedisService = /src\/core\/redis\/redis\.service(\.spec)?\.ts$/.test(filename);
    if (!isRedisService) return {};

    return {
      CallExpression(node) {
        if (!isBlockingSharedClientCall(node)) return;

        const enclosing = getEnclosingFunctionName(node);
        if (enclosing === 'createClient' || enclosing === 'createSubscriber') return;

        const callee = node.callee;
        const method = callee.property.name;

        context.report({
          node,
          messageId: 'blockingOnSharedClient',
          data: { method },
        });
      },
    };
  },
};
