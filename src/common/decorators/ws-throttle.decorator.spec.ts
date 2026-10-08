import 'reflect-metadata';
import {
  WS_THROTTLE_METADATA_KEY,
  WS_THROTTLE_PUBLIC_METADATA_KEY,
  WsThrottle,
  WsThrottlePublic,
} from './ws-throttle.decorator';

describe('@WsThrottle decorator', () => {
  it('stores the provided options under WS_THROTTLE_METADATA_KEY on the handler', () => {
    class Host {
      @WsThrottle({ default: { limit: 25, ttl: 30_000 } })
      handler(): void {
        return;
      }
    }

    const options = Reflect.getMetadata(WS_THROTTLE_METADATA_KEY, Host.prototype.handler);
    expect(options).toEqual({ default: { limit: 25, ttl: 30_000 } });
  });

  it('@WsThrottlePublic sets the public metadata flag', () => {
    class Host {
      @WsThrottlePublic()
      handler(): void {
        return;
      }
    }

    const flag = Reflect.getMetadata(WS_THROTTLE_PUBLIC_METADATA_KEY, Host.prototype.handler);
    expect(flag).toBe(true);
  });

  it('@WsThrottlePublic on a class sets the flag on the class', () => {
    @WsThrottlePublic()
    class Host {
      handler(): void {
        return;
      }
    }

    const flag = Reflect.getMetadata(WS_THROTTLE_PUBLIC_METADATA_KEY, Host);
    expect(flag).toBe(true);
  });
});
