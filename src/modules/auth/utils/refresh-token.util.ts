export const extractRefreshTokenFromCookies = (cookies: unknown): string | null => {
  if (!cookies || typeof cookies !== 'object') {
    return null;
  }

  const candidate = (cookies as Record<string, unknown>).refreshToken;
  return typeof candidate === 'string' ? candidate : null;
};
