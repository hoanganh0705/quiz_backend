// @ts-check
'use strict';

/**
 * Forbid `@Cron`-decorated class methods that do not invoke
 * `acquireSchedulerLockOrRecordSkip`.
 *
 * Background
 * ----------
 * Multiple cron handlers in the codebase originally executed
 * without acquiring the shared Redis advisory lock. In
 * multi-replica deployments every replica fires the cron
 * expression, which previously caused duplicate work, rare
 * constraint-violations, and `InstanceCountdownScheduler`-style
 * thundering herd problems.
 *
 * The remediation plan formalises the lock boundary by
 * requiring every `@Cron` method to wrap its body in
 * `acquireSchedulerLockOrRecordSkip({ cache, circuit, ... })`.
 * This rule enforces the contract at lint-time so a future
 * `@Cron` method cannot be added without the lock call.
 *
 * Acceptance shapes
 * -----------------
 * The cron tick is considered "locked" when one of the
 * following holds for the method body (transitively through
 * `this.x(...)` calls):
 *
 *   1. The body references `acquireSchedulerLockOrRecordSkip`
 *      directly.
 *   2. The body references `this.runIfLockAcquired(...)` (the
 *      default wrapper introduced during this remediation).
 *   3. The body calls a same-class helper whose body invokes
 *      `acquireSchedulerLockOrRecordSkip`. Detection of helper
 *      bodies is keyed off the helper's name: any helper
 *      whose name ends in `acquireLockOrSkip` or
 *      `runIfLockAcquired` is treated as a lock wrapper.
 */
const LOCK_PRIMITIVE = 'acquireSchedulerLockOrRecordSkip';
const LOCK_WRAPPER_NAME_PATTERNS = [
  /AcquireLockOrSkip$/u,
  /acquireLockOrSkip$/u,
  /runIfLockAcquired$/u,
  /runCleanup$/u,
  /runTick$/u,
];

/**
 * Returns true when the helper method's name matches one of
 * the lock-wrapper naming patterns.
 * @param {string} name
 */
function isLockWrapperName(name) {
  if (!name) return false;
  return LOCK_WRAPPER_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Walk an ESTree node (and its descendants) looking for a
 * CallExpression whose callee is the lock primitive.
 * @param {import('estree').Node | null | undefined} node
 */
function referencesLockPrimitive(node) {
  if (!node) return false;

  if (node.type === 'CallExpression') {
    const callee = node.callee;
    if (
      callee &&
      callee.type === 'Identifier' &&
      callee.name === LOCK_PRIMITIVE
    ) {
      return true;
    }
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === 'object' && referencesLockPrimitive(child)) {
          return true;
        }
      }
    } else if (typeof value.type === 'string') {
      if (referencesLockPrimitive(value)) return true;
    }
  }
  return false;
}

/**
 * Returns true when the decorator list contains `@Cron(...)`
 * (or a bare `@Cron` identifier).
 * @param {ReadonlyArray<unknown> | undefined} decorators
 */
function hasCronDecorator(decorators) {
  if (!Array.isArray(decorators)) return false;
  return decorators.some((decorator) => {
    if (!decorator || typeof decorator !== 'object') return false;
    const expression = /** @type {Record<string, unknown>} */ (decorator).expression;
    if (!expression) return false;
    if (expression.type === 'Identifier' && expression.name === 'Cron') return true;
    if (
      expression.type === 'CallExpression' &&
      expression.callee &&
      typeof expression.callee === 'object' &&
      expression.callee.type === 'Identifier' &&
      expression.callee.name === 'Cron'
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Collect every `this.<identifier>(...)` callee name reached
 * from `node`. Used to decide which helper methods the cron
 * tick delegates to.
 * @param {import('estree').Node | null | undefined} node
 */
function collectThisCallTargets(node) {
  const names = new Set();
  if (!node) return names;

  const visit = (cur) => {
    if (!cur || typeof cur !== 'object') return;
    if (cur.type === 'CallExpression') {
      const callee = cur.callee;
      if (
        callee &&
        callee.type === 'MemberExpression' &&
        callee.object &&
        callee.object.type === 'ThisExpression' &&
        callee.property &&
        callee.property.type === 'Identifier'
      ) {
        names.add(callee.property.name);
      }
    }
    for (const key of Object.keys(cur)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = cur[key];
      if (!value || typeof value !== 'object') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (typeof value.type === 'string') visit(value);
    }
  };

  visit(node);
  return names;
}

/**
 * Walk the class body and produce a name → MethodDefinition map
 * for every method on the class.
 * @param {import('estree').ClassDeclaration} classNode
 * @returns {Map<string, import('estree').MethodDefinition>}
 */
function buildMethodIndex(classNode) {
  const index = new Map();
  const body = /** @type {{ body?: Array<unknown> } | null | undefined} */ (
    classNode.body
  );
  const members = body && Array.isArray(body.body) ? body.body : [];
  for (const member of members) {
    if (!member || typeof member !== 'object') continue;
    const m = /** @type {Record<string, unknown>} */ (member);
    if (m.type !== 'MethodDefinition') continue;
    const key = /** @type {Record<string, unknown> | null | undefined} */ (m.key);
    if (
      !key ||
      key.type !== 'Identifier' ||
      typeof key.name !== 'string'
    ) {
      continue;
    }
    index.set(key.name, /** @type {import('estree').MethodDefinition} */ (m));
  }
  return index;
}

/**
 * Determine whether the cron method body acquires the lock
 * either directly or via a same-class helper method whose
 * name matches one of the locked-wrapper patterns.
 * @param {import('estree').Node} body
 * @param {Map<string, import('estree').MethodDefinition>} methodIndex
 */
function bodyAcquiresLock(body, methodIndex) {
  if (referencesLockPrimitive(body)) return true;

  const called = collectThisCallTargets(body);
  for (const helper of called) {
    if (!isLockWrapperName(helper)) continue;
    const helperDef = methodIndex.get(helper);
    if (!helperDef) continue;
    const helperValue = /** @type {{ body?: unknown }} */ (helperDef).value;
    if (!helperValue) continue;

    if (referencesLockPrimitive(helperValue)) return true;
    const inner = collectThisCallTargets(helperValue);
    for (const grandchild of inner) {
      if (!isLockWrapperName(grandchild)) continue;
      const grandchildDef = methodIndex.get(grandchild);
      if (!grandchildDef) continue;
      const grandchildValue = /** @type {{ body?: unknown }} */ (grandchildDef).value;
      if (grandchildValue && referencesLockPrimitive(grandchildValue)) return true;
    }
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    name: 'no-unlocked-scheduler',
    type: 'problem',
    docs: {
      description:
        'Disallow `@Cron`-decorated class methods that do not wrap their body in `acquireSchedulerLockOrRecordSkip`. Multi-replica deploys fire every cron expression on every replica; without the lock, two replicas race each other.',
      recommended: 'error',
      requiresTypeChecking: false,
    },
    messages: {
      missingLockHelper:
        '`@Cron` method `{{ method }}` must invoke `acquireSchedulerLockOrRecordSkip` directly or via a same-class helper whose body acquires the lock. Without the lock, multi-replica deployments race and double-dispatch. See `acquireSchedulerLockOrRecordSkip` in `src/core/redis/scheduler-lock.helper.ts`.',
    },
    schema: [],
  },
  create(context) {
    /** @type {Map<string, import('estree').MethodDefinition>} */
    let methodIndex = new Map();

    return {
      ClassDeclaration(classNode) {
        methodIndex = buildMethodIndex(classNode);
      },
      'ClassDeclaration:exit'() {
        methodIndex = new Map();
      },
      MethodDefinition(node) {
        if (methodIndex.size === 0) return;

        const def = /** @type {Record<string, unknown>} */ (node);
        const decorators = def.decorators;
        if (!hasCronDecorator(decorators)) return;

        const methodKey = /** @type {Record<string, unknown> | null | undefined} */ (
          def.key
        );
        const methodName =
          methodKey && methodKey.type === 'Identifier' && typeof methodKey.name === 'string'
            ? methodKey.name
            : '<anonymous>';

        const value = /** @type {{ body?: unknown }} */ (def).value;
        if (!value) return;
        if (bodyAcquiresLock(value, methodIndex)) return;

        context.report({
          node: def,
          messageId: 'missingLockHelper',
          data: { method: methodName },
        });
      },
    };
  },
  __internals: {
    LOCK_PRIMITIVE,
    hasCronDecorator,
    referencesLockPrimitive,
    collectThisCallTargets,
    buildMethodIndex,
    bodyAcquiresLock,
    isLockWrapperName,
  },
};
