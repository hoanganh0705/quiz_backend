/**
 * Discussion module constants.
 *
 * Single source of truth for length caps, reply caps, and pagination defaults.
 * The values are referenced by request DTOs (`@MaxLength`), domain services
 * (reply cap enforcement), and the cross-module answer-shape of the
 * `CommentSortField` enum.
 */

export const MAX_COMMENT_BODY_LENGTH = 2000;

export const MAX_REPLIES_PER_COMMENT = 100;

export const MAX_REPORT_REASON_LENGTH = 500;

export const MAX_REPORT_DETAILS_LENGTH = 2000;

export const DISCUSSIONS_DEFAULT_PAGE_LIMIT = 20;

export const DISCUSSIONS_MAX_PAGE_LIMIT = 100;
