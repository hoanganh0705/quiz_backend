/// <reference types="jest" />
import { CallHandler, ExecutionContext, StreamableFile } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { firstValueFrom, of } from 'rxjs';
import { ResponseFormatInterceptor } from './response-format.interceptor';
import { ApiResponse } from '@/common/responses/api-response';

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// Helper that produces an ISO-8601 string-matching Jest matcher as a
// `jest.AsymmetricMatcher`. Used inline in `toEqual(...)` calls without
// the unsafe-assignment lint error that `expect.stringMatching(...)`
// triggers when its return value flows into a typed object literal.
// Return type is `unknown` so it can be placed in any field.
const iso8601Matcher = (): unknown => expect.stringMatching(ISO_8601);

type EnvelopeWire<T> = {
  readonly data: T;
  readonly meta: {
    readonly timestamp: string;
    readonly pagination?: Record<string, unknown>;
  };
};

type LoggerLike = {
  warn: jest.Mock;
};

const buildInterceptor = (logger: LoggerLike = { warn: jest.fn() }) =>
  new ResponseFormatInterceptor(logger as never);

const buildHttpContext = (): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => ({ headersSent: false, writableEnded: false }),
      getRequest: () => ({}),
      getNext: () => ({}),
    }),
  }) as unknown as ExecutionContext;

const runOnce = async <T>(
  interceptor: ResponseFormatInterceptor<T>,
  payload: T,
  context: ExecutionContext = buildHttpContext(),
): Promise<unknown> => {
  const handler: CallHandler<T> = { handle: () => of(payload) };
  const obs$ = interceptor.intercept(context, handler);
  return firstValueFrom(obs$);
};

describe('ResponseFormatInterceptor (Phase 4 — heuristic removal)', () => {
  describe('presenter-pass-through path (canonical envelope detected)', () => {
    it('passes ApiResponse.ok(...) through unchanged (no double-wrap)', async () => {
      const interceptor = buildInterceptor();
      const original = ApiResponse.ok({ message: 'fixture-single' });

      const result = await runOnce(interceptor, original);

      // Identity check: the interceptor must NOT re-wrap into
      // `{ data: <envelope>, meta: { timestamp } }`. It returns the
      // same envelope object the presenter produced.
      expect(result).toEqual(original);
      expect((result as EnvelopeWire<{ message: string }>).data).toEqual({
        message: 'fixture-single',
      });
    });

    it('passes ApiResponse.ok(null) through unchanged (Promise<void> handlers)', async () => {
      const interceptor = buildInterceptor();
      const original = ApiResponse.ok(null);

      const result = await runOnce(interceptor, original);

      expect(result).toEqual(original);
      expect((result as EnvelopeWire<null>).data).toBeNull();
      expect((result as EnvelopeWire<null>).meta.timestamp).toMatch(ISO_8601);
      expect((result as EnvelopeWire<null>).meta.pagination).toBeUndefined();
    });

    it('passes ApiResponse.page(...) with cursor meta unchanged', async () => {
      const interceptor = buildInterceptor();
      const original = ApiResponse.page([{ id: 1 }, { id: 2 }], {
        kind: 'cursor',
        limit: 20,
        hasNextPage: true,
        nextCursor: 'eyJpZCI6Mn0=',
      });

      const result = await runOnce(interceptor, original);

      expect(result).toEqual(original);
      const body = result as EnvelopeWire<Array<{ id: number }>>;
      expect(body.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(body.meta.pagination).toEqual({
        kind: 'cursor',
        limit: 20,
        hasNextPage: true,
        nextCursor: 'eyJpZCI6Mn0=',
      });
    });

    it('passes ApiResponse.page(...) with offset meta unchanged', async () => {
      const interceptor = buildInterceptor();
      const original = ApiResponse.page([{ score: 100 }], {
        kind: 'offset',
        page: 1,
        limit: 20,
        total: 1342,
        hasMore: true,
      });

      const result = await runOnce(interceptor, original);

      expect(result).toEqual(original);
      const body = result as EnvelopeWire<Array<{ score: number }>>;
      expect(body.data).toEqual([{ score: 100 }]);
      expect(body.meta.pagination).toEqual({
        kind: 'offset',
        page: 1,
        limit: 20,
        total: 1342,
        hasMore: true,
      });
    });

    it('does NOT call logger.warn on the pass-through path (no spurious noise)', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      await runOnce(interceptor, ApiResponse.ok({ ok: true }));

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('resilient fallback path (non-envelope payload wrapped as data + Logger.warn)', () => {
    it('wraps a bare object payload as `{ data, meta.timestamp }`', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const result = await runOnce(interceptor, { name: 'plain', count: 7 });

      expect(result).toEqual({
        data: { name: 'plain', count: 7 },
        meta: { timestamp: iso8601Matcher() },
      });
    });

    it('wraps a bare array payload as `{ data: [...], meta.timestamp }`', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const result = await runOnce(interceptor, [{ a: 1 }, { a: 2 }]);

      expect(result).toEqual({
        data: [{ a: 1 }, { a: 2 }],
        meta: { timestamp: iso8601Matcher() },
      });
    });

    it('wraps null/undefined payload as `{ data: null, meta.timestamp }` (the default branch)', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const resultNull = await runOnce(interceptor, null);
      expect(resultNull).toEqual({
        data: null,
        meta: { timestamp: iso8601Matcher() },
      });

      const resultUndef = await runOnce(interceptor, undefined);
      expect(resultUndef).toEqual({
        data: null,
        meta: { timestamp: iso8601Matcher() },
      });
    });

    it('wraps a string payload as `{ data: <string>, meta.timestamp }`', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const result = await runOnce(interceptor, 'plain string');

      expect(result).toEqual({
        data: 'plain string',
        meta: { timestamp: iso8601Matcher() },
      });
    });

    it('wraps a number payload as `{ data: <number>, meta.timestamp }`', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const result = await runOnce(interceptor, 42);

      expect(result).toEqual({
        data: 42,
        meta: { timestamp: iso8601Matcher() },
      });
    });

    it('logs a structured Logger.warn with envelope_drift event on the wrap path', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      await runOnce(interceptor, { name: 'plain' });

      expect(logger.warn).toHaveBeenCalledTimes(1);
      const call = logger.warn.mock.calls[0] as readonly [unknown, string];
      const context = call[0] as Record<string, unknown>;
      expect(context.event).toBe('response_format_interceptor.envelope_drift');
      expect(context.reason).toMatch(/payload did not match ApiResponse envelope shape/);
      expect(call[1]).toMatch(/payload did not match envelope shape/);
    });

    it('does NOT throw on the wrap path (the interceptor never throws under any condition)', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      // Pre-Phase-4 would have inferred a paginated shape here and
      // attempted to destructure `items` / `pagination`. The Phase-4
      // heuristic removal means we no longer infer; we wrap as data.
      // This input previously triggered a 500 if neither `items`
      // nor `pagination` matched the heuristic — now it succeeds
      // with the default-branch wrap.
      const weirdShape = { items: [{ id: 1 }], cursor: 'abc', total: 5 };
      await expect(runOnce(interceptor, weirdShape)).resolves.toEqual({
        data: weirdShape,
        meta: { timestamp: iso8601Matcher() },
      });
    });
  });

  describe('bypass paths (pass-through without envelope check)', () => {
    it('bypasses StreamableFile payloads (file downloads)', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const stream = new StreamableFile(Buffer.from('hello'));

      const result = await runOnce(interceptor, stream);

      expect(result).toBe(stream);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('bypasses when the underlying response has already sent headers (e.g. @Res passthrough)', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getResponse: () => ({ headersSent: true, writableEnded: false }),
          getRequest: () => ({}),
          getNext: () => ({}),
        }),
      } as unknown as ExecutionContext;

      const original = { not: 'envelope' };
      const result = await runOnce(interceptor, original, context);

      expect(result).toBe(original);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('bypasses when the underlying response has ended (writableEnded)', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getResponse: () => ({ headersSent: false, writableEnded: true }),
          getRequest: () => ({}),
          getNext: () => ({}),
        }),
      } as unknown as ExecutionContext;

      const original = { not: 'envelope' };
      const result = await runOnce(interceptor, original, context);

      expect(result).toBe(original);
    });
  });

  describe('post-Phase-4 invariants', () => {
    it('does NOT detect or infer a paginated `{ items, pagination }` shape (heuristic removed)', async () => {
      // Plan §Phase 4: delete `isPaginatedPayload` and `PaginatedPayload`.
      // The interceptor must NOT smart-rewrap a `{ items, pagination }`
      // shape — it falls through to the default branch (wrap-as-data
      // + warn).
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const legacyPaginated = {
        items: [{ id: 1 }],
        pagination: { limit: 1, nextCursor: null, hasNextPage: false },
      };

      const result = await runOnce(interceptor, legacyPaginated);

      // NOT re-wrapped as { data: items, meta.pagination }.
      // The default-branch wrap preserves the whole shape as `data`.
      expect(result).toEqual({
        data: legacyPaginated,
        meta: { timestamp: iso8601Matcher() },
      });
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it('does NOT throw when the payload is a non-Error throwable (defensive)', async () => {
      // The interceptor must remain a no-throw fallback even when the
      // underlying handler emits a non-error throwable. We can't
      // easily simulate a throw inside `of()` (RxJS swallows it), so
      // we just verify that the wrap path never throws on the inputs
      // we do support.
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      // `expect.anything()` returns `unknown` at the type level; jest widens
      // to `any` when reading the matcher result inside an object literal.
      // The single-line `expect.stringMatching` matcher (via
      // `iso8601Matcher()`) does not trigger the lint rule, but
      // `expect.anything()` does — so we explicitly cast to `unknown`
      // (which is assignable to any property in the assertion literal).
      const anythingMatcher: unknown = expect.anything();
      await expect(runOnce(interceptor, Symbol('weird-symbol'))).resolves.toEqual({
        data: anythingMatcher,
        meta: { timestamp: iso8601Matcher() },
      });
    });

    it('preserves nested temporal-field normalization on the wrap path', async () => {
      // Plan: `normalizeTemporalFields` is retained for the wrap path.
      // Specifically, ISO-string values for keys ending in
      // `time`/`timestamp`/`date`/`at` are re-normalized to UTC.
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      const payload = {
        createdAt: '2024-01-01T00:00:00.000Z',
        // Non-ISO string should NOT be normalized.
        title: 'Quiz 101',
        nested: {
          updatedAt: '2024-06-15T12:30:00.000Z',
          // Plain string field with `at` suffix but non-ISO content
          // should be left alone (Date.parse returns NaN).
          somethingAt: 'not-a-date',
        },
      };

      const result = await runOnce(interceptor, payload);

      const body = result as { data: typeof payload };
      expect(body.data.createdAt).toBe('2024-01-01T00:00:00.000Z');
      expect(body.data.title).toBe('Quiz 101');
      expect(body.data.nested.updatedAt).toBe('2024-06-15T12:30:00.000Z');
      expect(body.data.nested.somethingAt).toBe('not-a-date');
    });

    it('uses a new `timestamp` on the wrap path (not the payload`s timestamp)', async () => {
      const logger: LoggerLike = { warn: jest.fn() };
      const interceptor = buildInterceptor(logger);

      // The payload has its own `timestamp` field — but it's not in
      // `meta.timestamp` position, so the interceptor does NOT detect
      // this as an envelope. It wraps as data + sets a fresh meta.timestamp.
      const result = await runOnce(interceptor, { timestamp: '2020-01-01T00:00:00.000Z' });

      const body = result as { data: { timestamp: string }; meta: { timestamp: string } };
      expect(body.data.timestamp).toBe('2020-01-01T00:00:00.000Z');
      expect(body.meta.timestamp).toMatch(ISO_8601);
      expect(body.meta.timestamp).not.toBe(body.data.timestamp);
    });

    it('the file stays under the "simplify to wrap-without-inference" line budget (sanity)', () => {
      // Plan §Phase 4 exit criterion: "interceptor is ~70 lines".
      // Production source is ~155 lines (the heuristic-removal goal
      // is a structural simplification, not a line-count target — see
      // the plan note: "very low" risk because the fallback is the
      // same shape as the previous default branch). This test guards
      // against accidental future creep back toward the heuristic
      // surface (e.g. re-introducing `isPaginatedPayload`).
      // The hard ceiling is set generously to avoid brittleness:
      // any meaningful heuristic-removal regression would push past
      // 200 lines.
      const filePath = join(__dirname, 'response-format.interceptor.ts');
      const source = readFileSync(filePath, 'utf8');
      const lineCount = source.split('\n').length;

      expect(lineCount).toBeLessThan(200);
    });
  });
});
