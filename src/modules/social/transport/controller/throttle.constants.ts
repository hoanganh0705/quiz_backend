import { SOCIAL_THROTTLE_VALUES } from '@/core/config';
import type { SocialThrottleConfig } from '@/core/config';

export const SOCIAL_THROTTLE: Readonly<SocialThrottleConfig> = Object.freeze({
  ...SOCIAL_THROTTLE_VALUES,
});
