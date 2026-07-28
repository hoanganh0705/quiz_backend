import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Phase 7 (F-14): validates the shape of the `preferences` JSON blob
 * written to `users.settings`. The DB column is JSONB and accepts any
 * tree, but the application contract is tighter:
 *
 *   - top-level keys: capped via `@MaxKeys` (separate validator).
 *   - key strings:    capped via `@MaxKeyStringLength` (separate).
 *   - value depth:    at most {@link PREFERENCES_MAX_DEPTH} (this check).
 *   - string values:  at most {@link PREFERENCES_MAX_STRING_LENGTH} chars
 *                     (this check; the DB column has no length cap).
 *   - no binary blobs: `Buffer` instances are rejected (this check).
 *
 * The audit recommends a dedicated validator rather than reusing
 * `@IsObject` + nested decorators because the constraints are
 * shape-based and class-validator has no first-class support for
 * recursive depth / string-length caps. The recursive walk is bounded
 * by `depth <= PREFERENCES_MAX_DEPTH` so a hostile payload cannot
 * blow the stack.
 */
export const PREFERENCES_MAX_DEPTH = 3;
export const PREFERENCES_MAX_STRING_LENGTH = 1000;

function isBufferLike(value: unknown): boolean {
  if (typeof Buffer !== 'undefined' && value instanceof Buffer) return true;
  // Some serializers (e.g. the one used in tests) emit plain objects
  // with a `type: 'Buffer'` and a `data: number[]` payload. Treat
  // those as binary too — a JSONB blob should never carry Node
  // Buffer internals over the wire.
  if (
    value !== null &&
    typeof value === 'object' &&
    (value as { type?: unknown }).type === 'Buffer' &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return true;
  }
  return false;
}

/**
 * Recursive shape check. Returns the path of the first violation, or
 * `null` if the payload is acceptable.
 */
function findPreferencesViolation(
  value: unknown,
  depth: number,
): { path: string; reason: string } | null {
  if (depth > PREFERENCES_MAX_DEPTH) {
    return { path: '', reason: `value depth exceeds ${PREFERENCES_MAX_DEPTH}` };
  }

  if (value === null) return null;

  if (isBufferLike(value)) {
    return { path: '', reason: 'binary blob (Buffer) is not allowed' };
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const violation = findPreferencesViolation(value[i], depth + 1);
      if (violation) {
        return { path: `[${i}]${violation.path}`, reason: violation.reason };
      }
    }
    return null;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const violation = findPreferencesViolation(v, depth + 1);
      if (violation) {
        return { path: `.${k}${violation.path}`, reason: violation.reason };
      }
    }
    return null;
  }

  if (typeof value === 'string') {
    if (value.length > PREFERENCES_MAX_STRING_LENGTH) {
      return {
        path: '',
        reason: `string length ${value.length} exceeds ${PREFERENCES_MAX_STRING_LENGTH}`,
      };
    }
    return null;
  }

  // Numbers, booleans are fine.
  return null;
}

export function IsShallowPreferencesBlob(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'IsShallowPreferencesBlob',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'object' || Array.isArray(value)) return false;
          return findPreferencesViolation(value, 0) === null;
        },
        defaultMessage(args: ValidationArguments): string {
          const violation = findPreferencesViolation(args.value, 0);
          if (!violation) {
            return `${args.property} must be a JSON object`;
          }
          return `${args.property} violates preferences shape at "${violation.path || '<root>'}": ${violation.reason}`;
        },
      },
    });
  };
}
