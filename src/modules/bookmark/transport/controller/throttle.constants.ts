import { BOOKMARK_THROTTLE_VALUES } from '@/core/config';
import type { BookmarkThrottleConfig } from '@/core/config';

export const BOOKMARK_THROTTLE: Readonly<BookmarkThrottleConfig> = Object.freeze({
  ...BOOKMARK_THROTTLE_VALUES,
});
