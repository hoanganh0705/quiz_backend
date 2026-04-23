export const hasOwn = <T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> => Object.hasOwn(value, key);
