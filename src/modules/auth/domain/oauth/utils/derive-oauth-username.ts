/**
 * Derives a single, deterministic OAuth username from email + userId.
 *
 * Format: {localPart}_{first8HexId}
 *   e.g. "john_a1b2c3d4"
 *
 * If the local part is empty (edge case: "@domain.com"), falls back to "user_{id}".
 * Local part is sanitized: lowercase, alphanumeric + underscore only, max 22 chars.
 *
 * This function is deterministic and reproducible. The same email + userId
 * always yields the same username — no retries, no randomness, no savepoints.
 */
export function deriveOAuthUsername(email: string, preGeneratedUserId: string): string {
  const local =
    email
      .split('@')[0]
      ?.toLowerCase()
      .replace(/[^a-z0-9_]/g, '') ?? '';
  const compactId = preGeneratedUserId.replace(/-/g, '').slice(0, 8);

  const base = local.slice(0, 22); // leave room for _ + 8 hex chars
  const suffix = `${base}_${compactId}`;

  return base.length > 0 ? suffix : `user_${compactId}`;
}
