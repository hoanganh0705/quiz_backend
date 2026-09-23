/* eslint-disable @typescript-eslint/require-await */
import { BadRequestException } from '@nestjs/common';
import { SearchApplicationService } from './search.application.service';

type Row = Record<string, unknown>;
type FakeExecute = jest.Mock<Promise<{ rows: Row[] }>, [unknown]>;

function getQueryString(query: unknown): string {
  const q = query as { queryChunks?: unknown[] };
  if (!q?.queryChunks) return '';
  let out = '';
  for (const chunk of q.queryChunks) {
    if (typeof chunk === 'string') {
      out += chunk;
      continue;
    }
    if (chunk && typeof chunk === 'object') {
      const c = chunk as { value?: unknown; queryChunks?: unknown[] };
      if (c.value !== undefined && (typeof c.value === 'string' || typeof c.value === 'number')) {
        out += String(c.value);
      } else if (c.queryChunks) {
        out += getQueryString(chunk);
      }
    }
  }
  return out;
}

function buildService(
  impl: (queryString: string, callIndex: number) => Promise<{ rows: Row[] }> = async () => ({
    rows: [],
  }),
) {
  let callIndex = 0;
  const execute: FakeExecute = jest.fn(async (q: unknown) => {
    const idx = callIndex;
    callIndex += 1;
    return impl(getQueryString(q), idx);
  });
  const db = { execute } as never;
  return { service: new SearchApplicationService(db), execute };
}

describe('SearchApplicationService', () => {
  it('rejects an empty query with a BadRequestException', async () => {
    const { service } = buildService();

    await expect(service.search('', 10)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('echoes the query and limit in the envelope, calling every section', async () => {
    const { service, execute } = buildService();

    const result = await service.search('nestjs', 5);

    expect(result.query).toBe('nestjs');
    expect(result.limit).toBe(5);
    expect(result.hasNextPage).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.users).toEqual([]);
    expect(result.quizzes).toEqual([]);
    expect(result.comments).toEqual([]);
    expect(result.categories).toEqual([]);
    expect(result.tags).toEqual([]);
    expect(execute).toHaveBeenCalledTimes(5);
  });

  it('maps user rows to the SearchUserResult shape', async () => {
    const { service } = buildService(async (_src, idx) =>
      idx === 0
        ? { rows: [{ userId: 'u1', username: 'alpha', displayName: 'Alpha User' }] }
        : { rows: [] },
    );

    const result = await service.search('alpha', 10);

    expect(result.users).toEqual([{ userId: 'u1', username: 'alpha', displayName: 'Alpha User' }]);
  });

  it('maps quiz rows', async () => {
    const { service } = buildService(async (_src, idx) =>
      idx === 1
        ? { rows: [{ quizId: 'q1', title: 'Advanced NestJS', slug: 'advanced-nestjs' }] }
        : { rows: [] },
    );

    const result = await service.search('nestjs', 10);

    expect(result.quizzes).toEqual([
      { quizId: 'q1', title: 'Advanced NestJS', slug: 'advanced-nestjs' },
    ]);
  });

  it('maps comment rows preserving comment + quiz ids', async () => {
    const { service } = buildService(async (_src, idx) =>
      idx === 2 ? { rows: [{ commentId: 'c1', quizId: 'q9' }] } : { rows: [] },
    );

    const result = await service.search('hello', 10);

    expect(result.comments).toEqual([{ commentId: 'c1', quizId: 'q9' }]);
  });

  it('maps category rows including nullable slugs', async () => {
    const { service } = buildService(async (_src, idx) =>
      idx === 3 ? { rows: [{ categoryId: 'c1', name: 'Web', slug: null }] } : { rows: [] },
    );

    const result = await service.search('web', 10);

    expect(result.categories).toEqual([{ categoryId: 'c1', name: 'Web', slug: null }]);
  });

  it('maps tag rows stripping extra columns', async () => {
    const { service } = buildService(async (_src, idx) =>
      idx === 4 ? { rows: [{ tagId: 't1', name: 'typescript', extra: 'ignored' }] } : { rows: [] },
    );

    const result = await service.search('typescript', 10);

    expect(result.tags).toEqual([{ tagId: 't1', name: 'typescript' }]);
  });

  it('strips non-alphanumeric chars when building prefix tokens', async () => {
    const { service, execute } = buildService();

    await service.search('nest.js advanced', 10);

    const sawPrefix = execute.mock.calls.some(([q]: [unknown]) => {
      const src = getQueryString(q);
      return src.includes('nest:*') || src.includes('js:*');
    });
    expect(sawPrefix).toBe(true);
  });

  it('drops tokens consisting only of punctuation', async () => {
    const { service } = buildService();

    const result = await service.search('!!! ???', 10);

    expect(result.users).toEqual([]);
    expect(result.quizzes).toEqual([]);
    expect(result.tags).toEqual([]);
  });
});
