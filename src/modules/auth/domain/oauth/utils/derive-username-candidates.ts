/**
 * Derives a deterministic list of username candidates from an email and a pre-generated userId.
 *
 * The candidate order is:
 *  1. local-part of email (sanitized)
 *  2. local-part + first 4 chars of uuid
 *  3. local-part + first 8 chars of uuid
 *  4. "user_" + first 8 chars of uuid
 *
 * There is NO randomness in this function. The same email + userId will always
 * produce the same candidates, enabling reproducible tests and safe retries.
 */
export function deriveUsernameCandidates(email: string, preGeneratedUserId: string): string[] {
  const local = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 30);

  const base = local || 'user';
  const compactUserId = preGeneratedUserId.replace(/-/g, '');

  return [
    base,
    `${base}_${compactUserId.slice(0, 4)}`,
    `${base}_${compactUserId.slice(0, 8)}`,
    `user_${compactUserId.slice(0, 8)}`,
  ];
}
