/**
 * Phase 5 #1 — Drizzle tracing wrapper unit tests.
 *
 * Verifies:
 *   - `select`, `insert`, `update`, `delete`, `execute`,
 *     `transaction` all emit `client` spans with `db.operation`.
 *   - Non-traced methods pass through unchanged.
 *   - Spans carry the `db.system=postgresql` attribute.
 */

import { TracingProvider, type Span } from './tracing.provider';
import { DrizzleTracingWrapper } from './drizzle-tracing.wrapper';

const spansSeen: Span[] = [];

class CaptureTracing extends TracingProvider {
  constructor() {
    super({} as never);
  }
  flush(): void {
    spansSeen.push(...this.completedSpans.splice(0, this.completedSpans.length));
  }
}

describe('DrizzleTracingWrapper', () => {
  let tracing: CaptureTracing;
  let wrapper: DrizzleTracingWrapper;

  beforeEach(() => {
    spansSeen.length = 0;
    tracing = new CaptureTracing();
    wrapper = new DrizzleTracingWrapper(tracing as never);
  });

  const makeFakeClient = () => ({
    select: jest.fn(async () => [{ id: 1 }]),
    insert: jest.fn(async () => []),
    update: jest.fn(async () => []),
    delete: jest.fn(async () => []),
    execute: jest.fn(async () => []),
    transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb({})),
    options: { connectionString: 'postgres://localhost' },
  });

  it('wraps SELECT in a span with db.operation=select', async () => {
    const fake = makeFakeClient();
    const traced = wrapper.wrap(fake);
    await traced.select();
    tracing['flush']();
    expect(spansSeen).toHaveLength(1);
    expect(spansSeen[0].name).toBe('db.select');
    expect(spansSeen[0].attributes['db.system']).toBe('postgresql');
    expect(spansSeen[0].attributes['db.operation']).toBe('select');
  });

  it('wraps INSERT/UPDATE/DELETE/EXECUTE/TRANSACTION the same way', async () => {
    const fake = makeFakeClient();
    const traced = wrapper.wrap(fake);
    await traced.insert();
    await traced.update();
    await traced.delete();
    await traced.execute();
    await traced.transaction(async () => undefined);
    tracing['flush']();
    expect(spansSeen).toHaveLength(5);
    expect(spansSeen.map((s) => s.name)).toEqual([
      'db.insert',
      'db.update',
      'db.delete',
      'db.execute',
      'db.transaction',
    ]);
  });

  it('does not wrap non-traced methods (e.g. options)', () => {
    const fake = makeFakeClient();
    const traced = wrapper.wrap(fake);
    expect(traced.options).toBe(fake.options);
    tracing['flush']();
    expect(spansSeen).toHaveLength(0);
  });
});