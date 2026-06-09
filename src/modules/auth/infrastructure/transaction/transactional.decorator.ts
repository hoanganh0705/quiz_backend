export const AUTH_TRANSACTIONAL_KEY = Symbol('AUTH_TRANSACTIONAL_KEY');

export function Transactional(): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    Reflect.defineMetadata(AUTH_TRANSACTIONAL_KEY, true, descriptor.value!);
    return descriptor;
  };
}
