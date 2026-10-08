import { SetMetadata } from '@nestjs/common';

export interface WsThrottleOptions {
  default: {
    limit: number;
    ttl: number;
  };
}

export const WS_THROTTLE_METADATA_KEY = 'wsThrottle';

export const WsThrottle = (options: WsThrottleOptions) =>
  SetMetadata(WS_THROTTLE_METADATA_KEY, options);

export const WS_THROTTLE_PUBLIC_METADATA_KEY = 'wsThrottlePublic';

export const WsThrottlePublic = () => SetMetadata(WS_THROTTLE_PUBLIC_METADATA_KEY, true);
