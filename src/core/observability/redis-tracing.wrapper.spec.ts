/**
 * Phase 5 #1 — Redis tracing wrapper unit tests.
 *
 * Verifies:
 *   - Only traced commands emit spans.
 *   - Non-traced methods (e.g. `status`) pass through unchanged.
 *   - Spans capture the command name as an attribute.
 *   - Exceptions propagate to the caller while still being
 *     recorded on the span.
 */

import { TracingProvider, type Span } from './tracing.provider';
import { RedisTracingWrapper } from './redis-tracing.wrapper';

const spansSeen: Span[] = [];

class CaptureTracing extends TracingProvider {
  constructor() {
    super({} as never);
  }
  flush(): void {
    spansSeen.push(...this.completedSpans.splice(0, this.completedSpans.length));
  }
}

const makeRedisFake = () => {
  return {
    get: jest.fn(async (key: string) => `value-${key}`),
    set: jest.fn(async () => 'OK'),
    del: jest.fn(async () => 1),
    status: 'ready',
    duplicate: jest.fn(),
  };
};

describe('RedisTracingWrapper', () => {
  let tracing: CaptureTracing;
  let wrapper: RedisTracingWrapper;

  beforeEach(() => {
    spansSeen.length = 0;
    tracing = new CaptureTracing();
    wrapper = new RedisTracingWrapper(tracing as never);
  });

  it('wraps GET in a span with redis.command attribute', async () => {
    const fake = makeRedisFake();
    const traced = wrapper.wrap(fake as never);
    const result = await traced.get('key');
    expect(result).toBe('value-key');
    tracing['flush']();
    expect(spansSeen).toHaveLength(1);
    const span = spansSeen[0];
    expect(span.name).toBe('redis.GET');
    expect(span.attributes['redis.command']).toBe('get');
    expect(span.attributes['redis.key_count']).toBe(1);
  });

  it('does NOT trace non-command methods like status or duplicate', async () => {
    const fake = makeRedisFake();
    const traced = wrapper.wrap(fake as never);
    expect(traced.status).toBe('ready');
    tracing['flush']();
    expect(spansSeen).toHaveLength(0);
  });

  it('records the exception on the span when the command throws', async () => {
    const fake = makeRedisFake();
    fake.get.mockRejectedValueOnce(new Error('connection refused'));
    const traced = wrapper.wrap(fake as never);
    await expect(traced.get('key')).rejects.toThrow('connection refused');
    tracing['flush']();
    expect(spansSeen).toHaveLength(1);
    expect(spansSeen[0].status).toBe('error');
  });
});