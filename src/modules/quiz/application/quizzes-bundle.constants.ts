/**
 * Quiz directory bundle limits.
 *
 * The rail sections are supplementary context, so they are capped well below
 * the listing page size to keep a single directory view cheap to assemble.
 */
export const QUIZ_BUNDLE_LIMITS = {
  DEFAULT_RAIL_LIMIT: 10,
  MAX_RAIL_LIMIT: 25,
} as const;
