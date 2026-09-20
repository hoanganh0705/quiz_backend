export type CommentReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate_content'
  | 'misinformation'
  | 'other';

export const COMMENT_REPORT_REASON_VALUES = [
  'spam',
  'harassment',
  'inappropriate_content',
  'misinformation',
  'other',
] as const satisfies readonly CommentReportReason[];

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_\-:.]+$/;
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;
