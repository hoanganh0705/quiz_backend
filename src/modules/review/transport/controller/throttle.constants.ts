import { REVIEW_THROTTLE_VALUES } from '@/core/config';
import type { ReviewThrottleConfig } from '@/core/config';

export const REVIEW_THROTTLE: Readonly<ReviewThrottleConfig> = Object.freeze({
  ...REVIEW_THROTTLE_VALUES,
});
