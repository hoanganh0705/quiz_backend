import { ApiResponse } from './api-response';
import type { CursorPagination, OffsetPagination } from './pagination';

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('ApiResponse', () => {
  describe('ok()', () => {
    it('wraps a single-resource payload with a meta.timestamp', () => {
      const dto = { message: 'Account deleted successfully' };
      const result = ApiResponse.ok(dto);

      expect(result.data).toEqual({ message: 'Account deleted successfully' });
      expect(result.meta.timestamp).toMatch(ISO_8601);
      expect(result.meta.pagination).toBeUndefined();
    });

    it('wraps a list payload', () => {
      const list = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = ApiResponse.ok(list);

      expect(result.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
      expect(result.meta.timestamp).toMatch(ISO_8601);
      expect(result.meta.pagination).toBeUndefined();
    });

    it('wraps null for Promise<void> handlers with no body', () => {
      const result = ApiResponse.ok(null);

      expect(result.data).toBeNull();
      expect(result.meta.timestamp).toMatch(ISO_8601);
      expect(result.meta.pagination).toBeUndefined();
    });

    it('produces a fresh ISO timestamp per call', () => {
      const a = ApiResponse.ok({ x: 1 }).meta.timestamp;
      const b = ApiResponse.ok({ x: 1 }).meta.timestamp;
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
      expect(a).toMatch(ISO_8601);
      expect(b).toMatch(ISO_8601);
    });

    it('returns a plain-object envelope that the ResponseFormatInterceptor accepts', () => {
      const result = ApiResponse.ok({ message: 'ok' });
      const proto = Object.getPrototypeOf(result) as unknown;
      expect(proto === Object.prototype || proto === null).toBe(true);
      expect(typeof result.meta).toBe('object');
      expect(typeof result.meta.timestamp).toBe('string');
    });
  });

  describe('page()', () => {
    const cursorMeta: CursorPagination = {
      kind: 'cursor',
      limit: 20,
      hasNextPage: true,
      nextCursor: 'eyJpZCI6Li4ufQ==',
    };

    const offsetMeta: OffsetPagination = {
      kind: 'offset',
      page: 1,
      limit: 20,
      total: 1342,
      hasMore: true,
    };

    it('wraps an array of items with cursor pagination meta', () => {
      const items = [{ id: 'a' }, { id: 'b' }];
      const result = ApiResponse.page(items, cursorMeta);

      expect(result.data).toEqual([{ id: 'a' }, { id: 'b' }]);
      expect(result.meta.timestamp).toMatch(ISO_8601);
      expect(result.meta.pagination).toEqual(cursorMeta);
      expect(result.meta.pagination?.kind).toBe('cursor');
    });

    it('wraps an empty array', () => {
      const result = ApiResponse.page<{ id: string }>([], {
        kind: 'cursor',
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.pagination?.kind).toBe('cursor');
    });

    it('wraps with offset pagination meta', () => {
      const items = [{ score: 100 }, { score: 90 }, { score: 80 }];
      const result = ApiResponse.page(items, offsetMeta);

      expect(result.data).toEqual([{ score: 100 }, { score: 90 }, { score: 80 }]);
      expect(result.meta.timestamp).toMatch(ISO_8601);
      expect(result.meta.pagination).toEqual(offsetMeta);
      expect(result.meta.pagination?.kind).toBe('offset');
    });

    it('preserves readonly input arrays by producing a defensive copy', () => {
      const source: readonly { id: number }[] = Object.freeze([{ id: 1 }, { id: 2 }]);
      const result = ApiResponse.page(source, {
        kind: 'cursor',
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });

      expect(result.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(result.data).not.toBe(source);
    });

    it('returns a plain-object envelope that the ResponseFormatInterceptor accepts', () => {
      const result = ApiResponse.page([{ id: 1 }], cursorMeta);
      const proto = Object.getPrototypeOf(result) as unknown;
      expect(proto === Object.prototype || proto === null).toBe(true);
      expect(typeof result.meta).toBe('object');
      expect(typeof result.meta.timestamp).toBe('string');
    });
  });
});
