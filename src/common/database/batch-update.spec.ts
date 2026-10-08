import { sql } from 'drizzle-orm';
import { batchUpdateWithValues } from './batch-update';

type DrizzleLike = Parameters<typeof batchUpdateWithValues>[0];

type CapturedBind = { kind: 'string'; value: string } | { kind: 'other'; value: unknown };

function makeDb(): {
  db: DrizzleLike;
  executed: string[];
  bindings: CapturedBind[];
} {
  const executed: string[] = [];
  const bindings: CapturedBind[] = [];
  const db = {
    execute: jest.fn((statement: ReturnType<typeof sql>) => {
      // The `sql` template is an array-like; flattening via queryChunks
      // gives us a stable text we can assert on for "single statement"
      // semantics. Bind values are kept in `bindings` so tests can assert
      // on their rendered form independently of placeholder positions.
      const flatten = (value: unknown, intoBindings: boolean): string => {
        if (typeof value === 'string') return value;
        if (
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          value === null ||
          value instanceof Date
        ) {
          if (intoBindings) {
            bindings.push({ kind: 'other', value });
          }
          return '?';
        }
        if (Array.isArray(value)) return value.map((v) => flatten(v, intoBindings)).join('');
        if (value && typeof value === 'object') {
          const candidate = value as { query?: unknown; value?: unknown; queryChunks?: unknown };
          if (typeof candidate.query === 'string') return candidate.query;
          if (candidate.queryChunks !== undefined)
            return flatten(candidate.queryChunks, intoBindings);
          if (candidate.value !== undefined) return flatten(candidate.value, intoBindings);
        }
        return '';
      };
      flatten(statement, true);
      executed.push(flatten(statement, false));
      return Promise.resolve({ rowCount: 7 });
    }),
  };
  return { db: db as unknown as DrizzleLike, executed, bindings };
}

describe('batchUpdateWithValues', () => {
  it('returns 0 without executing anything when rows is empty', async () => {
    const { db, executed } = makeDb();
    const result = await batchUpdateWithValues(db, 'user_ranking', 'user_id', [] as const);
    expect(result).toBe(0);
    expect(executed).toHaveLength(0);
  });

  it('issues a single statement for a single row and returns the row count', async () => {
    const { db, executed } = makeDb();
    const result = await batchUpdateWithValues(db, 'user_ranking', 'user_id', [
      {
        key: '11111111-1111-7111-8111-111111111111',
        columns: { allTimeRank: 1, weeklyRank: 2 },
      },
    ]);
    expect(result).toBe(7);
    expect(executed).toHaveLength(1);

    const stmt = executed[0];
    expect(stmt).toContain('UPDATE "user_ranking" AS t');
    expect(stmt).toContain('SET "allTimeRank" = v."allTimeRank", "weeklyRank" = v."weeklyRank"');
    expect(stmt).toContain('FROM (VALUES');
    expect(stmt).toContain('AS v("user_id", "allTimeRank", "weeklyRank")');
    expect(stmt).toContain('WHERE t."user_id" = v."user_id"');
  });

  it('coerces Date values to ISO strings inside the VALUES tuple', async () => {
    const { db, executed } = makeDb();
    const updatedAt = new Date('2026-05-01T12:00:00.000Z');
    await batchUpdateWithValues(db, 'user_ranking', 'user_id', [
      {
        key: '22222222-2222-7222-8222-222222222222',
        columns: { lastActivityAt: updatedAt, isDirty: false },
      },
    ]);
    expect(executed).toHaveLength(1);
    // The bind value is the ISO string — Drizzle serialises the `sql` template
    // chunks into $1, $2, ... placeholders. The Date becomes its ISO form.
    expect(executed[0]).toContain('2026-05-01T12:00:00.000Z');
  });

  it('emits a single statement regardless of batch size', async () => {
    const { db, executed } = makeDb();
    const rows = Array.from({ length: 1000 }, (_, idx) => ({
      key: `00000000-0000-7000-8000-${String(idx).padStart(12, '0')}`,
      columns: { allTimeRank: idx + 1, weeklyRank: idx + 2 },
    }));
    await batchUpdateWithValues(db, 'user_ranking', 'user_id', rows);
    expect(executed).toHaveLength(1);
    // Spot-check that the bulk VALUES clause has all the rows. Each row is
    // rendered as `(<key>, <col1>, <col2>)` — keys are inlined as literals,
    // columns become `?` bind placeholders. Count the opening parens that
    // start a row tuple.
    expect(executed[0].match(/\(/g)?.length).toBeGreaterThanOrEqual(1000);
  });

  it('rejects rows with inconsistent column sets', async () => {
    const { db } = makeDb();
    await expect(
      batchUpdateWithValues(db, 'user_ranking', 'user_id', [
        { key: '1', columns: { allTimeRank: 1 } },
        { key: '2', columns: { allTimeRank: 2, weeklyRank: 3 } },
      ]),
    ).rejects.toThrow(/different column set/);
  });

  it('rejects non-scalar column values', async () => {
    const { db } = makeDb();
    await expect(
      batchUpdateWithValues(db, 'user_ranking', 'user_id', [
        { key: '1', columns: { allTimeRank: { complex: true } as unknown as number } },
      ]),
    ).rejects.toThrow(/must be a scalar value/);
  });

  it('rejects when no columns are provided', async () => {
    const { db } = makeDb();
    await expect(
      batchUpdateWithValues(db, 'user_ranking', 'user_id', [{ key: '1', columns: {} }]),
    ).rejects.toThrow(/at least one column/);
  });

  it('escapes identifiers with embedded double quotes', async () => {
    const { db, executed } = makeDb();
    await batchUpdateWithValues(db, 'weird"table', 'weird"key', [
      { key: '1', columns: { col: 'value' } },
    ]);
    expect(executed[0]).toContain('"weird""table" AS t');
    expect(executed[0]).toContain('"weird""key"');
  });
});
