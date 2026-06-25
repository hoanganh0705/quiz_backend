/**
 * Port interface for Redis pub/sub operations.
 *
 * Separated from CacheProvider so that consumers who only need pub/sub
 * (e.g. event buses) do not pull in the full cache surface.
 */

export interface PubSubProvider {
  /**
   * Publish a JSON-serialized payload on a Redis pub/sub channel.
   * Returns the number of subscribers that received the message
   * (0 is normal during a rolling deploy).
   */
  publish(channel: string, payload: unknown): Promise<number>;

  /**
   * Create a dedicated subscriber connection. Pub/sub in Redis
   * blocks the connection from running normal commands, so
   * subscribers must use a separate client. The caller is
   * responsible for calling `subscriber.quit()` on shutdown.
   */
  createSubscriber(): import('ioredis').default;
}

export const PUBSUB_PROVIDER = Symbol('PUBSUB_PROVIDER');
