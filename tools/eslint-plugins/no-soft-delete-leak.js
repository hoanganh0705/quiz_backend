// @ts-check
'use strict';

/**
 * Registry of soft-deletable tables — the single source of truth.
 * A table is soft-deletable when its schema defines `deletedAt`.
 * When a new table is added with a `deletedAt` column, add it here.
 *
 * Maps table identifiers (as used in `.from(table)`) to their
 * `deletedAt` column names (snake_case as they appear in SQL).
 * @type {Record<string, string>}
 */
const SOFT_DELETABLE_TABLES = {
  users: 'deleted_at',
  quizzes: 'deleted_at',
  tags: 'deleted_at',
  categories: 'deleted_at',
  friendships: 'deleted_at',
  blockedUsers: 'blocked_users',
  userFollows: 'user_follows',
  notifications: 'deleted_at',
  quizReviews: 'deleted_at',
  comments: 'deleted_at',
  tournaments: 'deleted_at',
  accounts: 'deleted_at',
  reviews: 'deleted_at',
  reviewHelpfulVotes: 'review_helpful_votes',
  reviewReports: 'review_reports',
};

/**
 * Returns true when the expression is a call to `notDeleted()` or `isNull()`.
 * @param {import('estree').Node} node
 * @returns {boolean}
 */
function isNullishGuard(node) {
  if (node && node.type === 'CallExpression') {
    const callee = node.callee;
    if (callee && callee.type === 'Identifier') {
      const name = callee.name;
      if (name === 'notDeleted' || name === 'isNull') return true;
    }
  }
  return false;
}

/**
 * Recursively walks an AST node and returns true if `notDeleted` or
 * `isNull` is called anywhere within it. Uses a visited set to avoid
 * infinite recursion on parent references (some ASTs include parent links).
 *
 * @param {import('estree').Node} node
 * @returns {boolean}
 */
function hasNotDeletedGuard(root) {
  if (!root || typeof root !== 'object' || !root.type) return false;
  if (isNullishGuard(root)) return true;

  // Bounded DFS with visited set so the traversal terminates.
  const stack = [];
  for (const key of Object.keys(root)) {
    if (key === 'parent') continue;
    const val = root[key];
    if (!val) continue;
    if (Array.isArray(val)) {
      for (const item of val) stack.push(item);
    } else if (typeof val === 'object' && val.type) {
      stack.push(val);
    }
  }

  const visited = new Set();
  visited.add(root);

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || !node.type) continue;
    if (visited.has(node)) continue;
    visited.add(node);

    if (isNullishGuard(node)) return true;

    for (const key of Object.keys(node)) {
      if (key === 'parent') continue;
      const val = node[key];
      if (!val) continue;
      if (Array.isArray(val)) {
        for (const item of val) stack.push(item);
      } else if (typeof val === 'object' && val.type) {
        stack.push(val);
      }
    }
  }

  return false;
}

/**
 * Collects all table identifiers referenced in a Drizzle `where()` call.
 * Handles:
 *   eq(tbl.col, value)       → tbl
 *   and(eq(...), ne(...))     → all tables in nested args
 *   or(eq(...), eq(...))      → all tables in nested args
 *   sql`${tbl.col} = ${val}`  → tbl (via template literal)
 *
 * @param {import('estree').Node} node
 * @param {Set<string>} tableNames
 */
function collectTablesFromWhere(node, tableNames) {
  switch (node.type) {
    case 'CallExpression': {
      const calleeName =
        node.callee.type === 'Identifier' ? node.callee.name : undefined;
      if (
        calleeName === 'eq' ||
        calleeName === 'ne' ||
        calleeName === 'gt' ||
        calleeName === 'lt' ||
        calleeName === 'gte' ||
        calleeName === 'lte' ||
        calleeName === 'inArray' ||
        calleeName === 'notInArray' ||
        calleeName === 'like' ||
        calleeName === 'ilike' ||
        calleeName === 'isNull' ||
        calleeName === 'isNotNull'
      ) {
        const firstArg = node.arguments[0];
        if (
          firstArg?.type === 'MemberExpression' &&
          firstArg.object.type === 'Identifier'
        ) {
          tableNames.add(firstArg.object.name);
        }
      }
      for (const arg of node.arguments) {
        collectTablesFromWhere(arg, tableNames);
      }
      break;
    }

    case 'BinaryExpression':
    case 'LogicalExpression':
      collectTablesFromWhere(node.left, tableNames);
      collectTablesFromWhere(node.right, tableNames);
      break;

    case 'TemplateLiteral':
      for (const expr of node.expressions) {
        if (expr.type === 'MemberExpression' && expr.object.type === 'Identifier') {
          tableNames.add(expr.object.name);
        }
        if (expr.type === 'CallExpression') {
          collectTablesFromWhere(expr, tableNames);
        }
      }
      break;

    case 'ConditionalExpression':
      collectTablesFromWhere(node.test, tableNames);
      collectTablesFromWhere(node.consequent, tableNames);
      collectTablesFromWhere(node.alternate, tableNames);
      break;

    case 'SequenceExpression':
      for (const expr of node.expressions) {
        collectTablesFromWhere(expr, tableNames);
      }
      break;

    default:
      break;
  }
}

/**
 * Returns the argument passed to `.where(...)`, or undefined if none.
 * @param {import('estree').CallExpression} node
 * @returns {import('estree').Node | undefined}
 */
function getWhereArg(node) {
  if (node.arguments.length >= 1) {
    return node.arguments[0];
  }
  return undefined;
}

/**
 * Check if a CallExpression is a `.where(...)` call on a Drizzle query.
 * Handles:
 *   select().from(tbl).where(...)
 *   update(tbl).where(...)
 *   delete(tbl).where(...)
 * @param {import('estree').CallExpression} node
 * @returns {boolean}
 */
function isWhereCall(node) {
  const callee = node.callee;
  if (callee.type !== 'MemberExpression') return false;
  if (callee.property.type !== 'Identifier') return false;
  if (callee.property.name !== 'where') return false;

  // Walk parent chain. For node `foo().bar()`, walking from the right side
  // works as: `node` is `foo().bar()`, its callee.object is `foo()`,
  // whose callee.object (recursively) leads to the first call.
  let cur = node;
  while (cur && cur.type === 'CallExpression') {
    const ce = cur.callee;
    if (ce.type === 'MemberExpression' && ce.property.type === 'Identifier') {
      const method = ce.property.name;
      if (
        method === 'select' ||
        method === 'update' ||
        method === 'delete' ||
        method === 'insert'
      ) {
        return true;
      }
      // step up: `foo().bar()` → keep traversing via the object side
      cur = ce.object;
    } else if (ce.type === 'MemberExpression') {
      // safety for nested member access
      cur = ce.object;
    } else {
      break;
    }
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    name: 'no-soft-delete-leak',
    type: 'problem',
    docs: {
      description:
        'Disallow Drizzle where() clauses on soft-deletable tables without notDeleted()',
      recommended: 'error',
      extendsBaseRule: false,
      deprecated: false,
      suggestion: false,
      requiresTypeChecking: false,
    },
    messages: {
      softDeleteLeak:
        'Table "{{ tableName }}" is soft-deletable (has deletedAt column). ' +
        'Every SELECT/UPDATE/DELETE against it must include notDeleted() or isNull() in the where clause. ' +
        'Add .where(and(notDeleted({{ tableName }}.deletedAt), ...)) to filter out deleted rows.',
    },
    fixable: undefined,
    hasSuggestions: false,
    schema: [],
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const filename = context.filename ?? '';

    if (!filename.includes('.repository.')) {
      return {};
    }

    /**
     * Returns true if the ancestor function/method name explicitly
     * targets deleted rows (e.g. `findByIdIncludingDeleted`,
     * `listDeletedReviews`). These are exempt from the rule.
     * @param {import('estree').Node} startNode
     */
    function isExemptByAncestorName(startNode) {
      const visited = new Set();
      let cur = startNode;
      while (cur && !visited.has(cur)) {
        visited.add(cur);
        // Walk name-bearing function-like ancestors.
        if (
          cur.type === 'FunctionDeclaration' ||
          cur.type === 'FunctionExpression' ||
          cur.type === 'ArrowFunctionExpression'
        ) {
          // Step up to the parent to find a method/property context.
          let parent = cur.parent;
          if (parent) {
            if (
              parent.type === 'MethodDefinition' &&
              parent.key &&
              parent.key.name
            ) {
              const name = parent.key.name;
              if (
                /IncludingDeleted$/.test(name) ||
                /Deleted$/.test(name) ||
                /^listDeleted/.test(name)
              ) {
                return true;
              }
            }
            if (
              parent.type === 'PropertyDefinition' &&
              parent.key &&
              parent.key.name
            ) {
              const name = parent.key.name;
              if (
                /IncludingDeleted$/.test(name) ||
                /Deleted$/.test(name) ||
                /^listDeleted/.test(name)
              ) {
                return true;
              }
            }
          }
          // Direct FunctionDeclaration with a name
          if (cur.type === 'FunctionDeclaration' && cur.id && cur.id.name) {
            const name = cur.id.name;
            if (
              /IncludingDeleted$/.test(name) ||
              /Deleted$/.test(name) ||
              /^listDeleted/.test(name)
            ) {
              return true;
            }
          }
        }
        cur = cur.parent;
      }
      return false;
    }

    /**
     * Resolves a class-level static predicate: when `where()` references a
     * member access like `Repo.NOT_DELETED_PREDICATE`, look up the static
     * property in the AST and check that it calls `notDeleted`/`isNull`.
     *
     * The lookup is bounded by filename and is best-effort — we follow
     * `ClassDeclaration`/`ClassExpression` and `PropertyDefinition` nodes
     * collected from this file's `Program`. If we cannot find a definition
     * we return false; the rule then reports the violation as before.
     *
     * @param {string} propertyName
     * @returns {boolean}
     */
    function staticPredicateCallsNotDeleted(propertyName) {
      const tree = sourceCode.ast ?? null;
      if (!tree) return false;
      const stack = [tree];
      const visited = new Set();
      while (stack.length > 0) {
        const node = stack.pop();
        if (!node || typeof node !== 'object' || !node.type || visited.has(node)) continue;
        visited.add(node);
        if (
          (node.type === 'PropertyDefinition' ||
            node.type === 'MethodDefinition') &&
          node.static &&
          node.key &&
          node.key.name === propertyName &&
          node.value
        ) {
          if (hasNotDeletedGuard(node.value)) {
            return true;
          }
          return false;
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;
          const val = node[key];
          if (!val) continue;
          if (Array.isArray(val)) {
            for (const item of val) stack.push(item);
          } else if (typeof val === 'object' && val.type) {
            stack.push(val);
          }
        }
      }
      return false;
    }

    /**
     * Returns true if the where clause directly references a class-level
     * static predicate that itself calls `notDeleted`/`isNull`. The pattern
     * is `ClassName.PREDICATE_NAME` where the predicate's RHS uses
     * `notDeleted(table.deletedAt)`.
     *
     * @param {import('estree').Node} whereArg
     * @returns {boolean}
     */
    function whereReferencesSafePredicate(whereArg) {
      const stack = [whereArg];
      const visited = new Set();
      while (stack.length > 0) {
        const node = stack.pop();
        if (!node || typeof node !== 'object' || !node.type || visited.has(node)) continue;
        visited.add(node);
        if (
          node.type === 'MemberExpression' &&
          node.object.type === 'Identifier' &&
          node.property.type === 'Identifier'
        ) {
          const propName = node.property.name;
          if (
            /PREDICATE$/i.test(propName) &&
            staticPredicateCallsNotDeleted(propName)
          ) {
            return true;
          }
        }
        for (const key of Object.keys(node)) {
          if (key === 'parent') continue;
          const val = node[key];
          if (!val) continue;
          if (Array.isArray(val)) {
            for (const item of val) stack.push(item);
          } else if (typeof val === 'object' && val.type) {
            stack.push(val);
          }
        }
      }
      return false;
    }

    return {
      CallExpression(node) {
        if (!isWhereCall(node)) return;

        if (isExemptByAncestorName(node)) return;

        const whereArg = getWhereArg(node);
        if (!whereArg) return;

        if (
          whereArg.type === 'Identifier' &&
          (whereArg.name === 'undefined' || whereArg.name === 'null')
        ) {
          return;
        }

        const tableNames = new Set();
        collectTablesFromWhere(whereArg, tableNames);

        if (tableNames.size === 0) return;

        // If the where clause references a class-level predicate constant
        // that itself calls notDeleted/isNull, skip the violation.
        if (whereReferencesSafePredicate(whereArg)) return;

        for (const tableName of tableNames) {
          if (Object.prototype.hasOwnProperty.call(SOFT_DELETABLE_TABLES, tableName)) {
            if (!hasNotDeletedGuard(whereArg)) {
              context.report({
                node,
                messageId: 'softDeleteLeak',
                data: { tableName },
              });
            }
          }
        }
      },
    };
  },
};
