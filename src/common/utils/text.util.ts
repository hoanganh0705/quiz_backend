export const trimString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimStringToLowerCase = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export const trimStringToNullIfBlank = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const normalizeNullableText = (
  value: string | null | undefined,
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};
