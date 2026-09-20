import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

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
