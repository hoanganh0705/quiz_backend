import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Validates that every top-level key string in a Record<string, unknown>
 * is no longer than `maxLength` characters.
 */
export function MaxKeyStringLength(maxLength: number, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'MaxKeyStringLength',
      target: object.constructor,
      propertyName,
      constraints: [maxLength],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return false;
          }
          const keys = Object.keys(value);
          return keys.every((k) => k.length <= maxLength);
        },
        defaultMessage(args: ValidationArguments): string {
          const limit = args.constraints[0] as number;
          return `Every object key must be at most ${limit} characters long.`;
        },
      },
    });
  };
}
