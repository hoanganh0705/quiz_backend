import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Validates that a Record<string, unknown> object has no more than `maxKeys` top-level keys.
 */
export function MaxKeys(maxKeys: number, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'MaxKeys',
      target: object.constructor,
      propertyName,
      constraints: [maxKeys],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
          }
          return Object.keys(value).length <= maxKeys;
        },
        defaultMessage(args: ValidationArguments): string {
          const value = (args.value ?? {}) as Record<string, unknown>;
          const count = Object.keys(value).length;
          const limit = args.constraints[0] as number;
          return `Object must have at most ${limit} keys, but has ${count}.`;
        },
      },
    });
  };
}
