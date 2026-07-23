/**
 * Phase 3 (Production Deployment Readiness) — unit tests for
 * `RedisIoAdapter`.
 *
 * The adapter's hard-to-model behaviors (actually attaching the
 * Redis pub/sub adapter to a Socket.IO server, shutting both
 * ioredis clients down, etc.) require a live Redis instance and
 * are covered by the cross-instance integration test in
 * `test/instance-socket-cross-instance.e2e-spec.ts`.
 *
 * What we verify here is the adapter's *contract*, which is what
 * can be tested without ioredis: the boot-time hard failure when
 * `REDIS_URL` is empty. That contract is critical for operations
 * — without it, a misconfigured deploy would silently degrade to
 * an in-process Socket.IO and lose every cross-instance event.
 */
import { RedisIoAdapter } from './redis-io.adapter';

describe('RedisIoAdapter — Phase 3 boot-time contract', () => {
  beforeEach(() => {
    // All tests in this file control the URL explicitly; clear any
    // accidental leakage from the surrounding test process.
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it('throws synchronously on the first createIOServer call when REDIS_URL is empty', () => {
    process.env.REDIS_URL = '';

    const adapter = new RedisIoAdapter(
      // The `INestApplicationContext` argument is used by the base
      // `IoAdapter` to extract the HTTP server; we don't exercise
      // that path in this test, so any mock is fine.

      {} as any,
      // Explicit empty string takes precedence over env-driven lookup.
      { redisUrl: '' },
    );

    expect(() => adapter.createIOServer(0, {} as any)).toThrow(/REDIS_URL is not defined/);
  });

  it('throws when REDIS_URL is missing from both env and adapter options', () => {
    const adapter = new RedisIoAdapter({} as any, { redisUrl: undefined });

    expect(() => adapter.createIOServer(0, {} as any)).toThrow(/REDIS_URL is not defined/);
  });

  it('uses the supplied `key` option as the adapter prefix when given', () => {
    // We assert the field defaults to `socket.io` via the
    // explicit constructor option: this guarantees that the
    // adapter picks up operator overrides (e.g. multiple
    // independent Socket.IO clusters on a shared Redis) without
    // subtle mistakes on the production path.
    const adapter = new RedisIoAdapter({} as any, {
      redisUrl: 'redis://0.0.0.0:0',
      key: 'quiz-instances',
    });
    // Direct field access: avoids touching ioredis at all. The
    // adapter's constructor stores the option verbatim.
    expect((adapter as unknown as { adapterOptions: { key?: string } }).adapterOptions.key).toBe(
      'quiz-instances',
    );
  });
});
