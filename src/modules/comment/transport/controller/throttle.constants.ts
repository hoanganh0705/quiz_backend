import { COMMENT_THROTTLE_VALUES } from '@/core/config';
import type { CommentThrottleConfig } from '@/core/config';

export const COMMENT_THROTTLE: Readonly<CommentThrottleConfig> = Object.freeze({
  ...COMMENT_THROTTLE_VALUES,
});
