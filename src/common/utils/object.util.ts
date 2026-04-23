export const hasOwn = <T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> => Object.hasOwn(value, key);

export const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]' &&
  value !== null &&
  !Array.isArray(value);
