/**
 * Per-field size limits enforced both by the request DTO
 * (`@MaxLength(N)`) and re-checked in the domain service after trim
 * (Phase 6 / F-16). The DB has an explicit `CHECK` constraint for
 * `display_name` (1-100 after btrim); `bio` and `avatar_url` are
 * unconstrained at the DB level. Keep these values in sync with
 * `update-me.dto.ts`.
 */
export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 100;
export const PROFILE_BIO_MAX_LENGTH = 500;
export const PROFILE_AVATAR_URL_MAX_LENGTH = 2048;

/**
 * Phase 8 (F-20): unified default for cursor-paginated list endpoints
 * in the user module. The audit recommends 20 across `listUserBadges`,
 * `listUserActivity`, `getMyTournaments`, and `getMyTournamentHistory`.
 * Previously `listUserBadges` defaulted to 10; the rest already used
 * 20. Every cursor-paginated list DTO in the user module imports this
 * constant so the default stays in sync.
 */
export const USER_PAGINATION_DEFAULT_LIMIT = 20;

export const XP_PER_LEVEL = 500;
