/**
 * Generic batch UPDATE helper for Drizzle / node-postgres.
 *
 * Translates an in-memory list of `{ key, columns }` pairs into a single
 * SQL statement of the shape
 *
 *   UPDATE <table>
 *      SET <col_a> = v.col_a,
 *          <col_b> = v.col_b,
 *          ...
 *     FROM (VALUES (key_a, col_a, col_b, ...),
 *                  (key_b, col_a, col_b, ...),
 *                  ...) AS v(<key>, <col_a>, <col_b>, ...)
 *    WHERE <table>.<key> = v.<key>;
 *
 * returning the row count reported by `pg`. A single round-trip replaces
 * what would otherwise be a per-row UPDATE loop (N statements, N bind
 * round-trips).
 *
 * ## Why this lives in `common/database`
 *
 * Several aggregates — ranking rank updates, peak-rank promotion, and
 * tournament-finalize rank materialization — share the same write
 * shape: a single key, a small set of scalar columns, no need for the
 * ORM's relational mapping. A thin SQL helper centralises the wire
 * format so each consumer stays a few lines and the EXPLAIN plan is
 * easy to keep stable.
 *
 * ## Caveats
 *
 * - The key column MUST exist on the target table; the helper does not
 *   validate the schema (Drizzle cannot reflect on `PgTable` without
 *   the runtime instance).
 * - The column list is restricted to scalar types (numbers, strings,
 *   booleans, ISO date strings). JSONB and array types would require
 *   `::jsonb` / `::type[]` casts the helper intentionally does not
 *   infer — callers should drop to `sql.raw` if they need that.
 * - The helper issues a single statement. Callers that need per-row
 *   failure isolation should NOT use this helper.
 */
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@/core/database/database.module';

type Scalar = string | number | boolean | Date | null;

export type BatchUpdateRow<TKey, TCol extends Record<string, Scalar>> = {
  key: TKey;
  columns: TCol;
};

type RawResult = {
  rowCount?: number | null;
};

const isScalar = (value: unknown): value is Scalar => {
  if (value === null) return true;
  if (typeof value === 'string') return true;
  if (typeof value === 'number') return true;
  if (typeof value === 'boolean') return true;
  if (value instanceof Date) return true;
  return false;
};

const escapeIdentifier = (identifier: string): string => `"${identifier.replace(/"/g, '""')}"`;

const toBindValue = (value: Scalar): string | number | boolean | null => {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
};

export async function batchUpdateWithValues<TKey, TCol extends Record<string, Scalar>>(
  db: DrizzleDB,
  tableName: string,
  keyColumnName: string,
  rows: ReadonlyArray<BatchUpdateRow<TKey, TCol>>,
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const sampleColumns = rows[0].columns;
  const columnNames = Object.keys(sampleColumns) as Array<keyof TCol & string>;

  if (columnNames.length === 0) {
    throw new Error('batchUpdateWithValues requires at least one column to update.');
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowColumnNames = Object.keys(row.columns);
    if (rowColumnNames.length !== columnNames.length) {
      throw new Error(`batchUpdateWithValues row ${i} declares a different column set than row 0.`);
    }
    for (const columnName of columnNames) {
      if (!isScalar(row.columns[columnName])) {
        throw new Error(
          `batchUpdateWithValues column "${String(columnName)}" must be a scalar value.`,
        );
      }
    }
  }

  const safeTable = escapeIdentifier(tableName);
  const safeKey = escapeIdentifier(keyColumnName);
  const safeColumns = columnNames.map((c) => escapeIdentifier(c));

  const setClause = safeColumns
    .map((column) => sql.raw(`${column} = v.${column}`))
    .reduce((acc, cur) => sql`${acc}, ${cur}`);

  const valueListColumns = sql.raw([safeKey, ...safeColumns].join(', '));

  const tupleChunks: ReturnType<typeof sql>[] = [];
  for (const row of rows) {
    const keyPlaceholder = sql`${String(row.key)}::text`;
    const columnPlaceholders = columnNames.map(
      (columnName) => sql`${toBindValue(row.columns[columnName])}`,
    );
    const tuple = sql`(${keyPlaceholder}, ${sql.join(columnPlaceholders, sql`, `)})`;
    tupleChunks.push(tuple);
  }
  const valuesClause = sql.join(tupleChunks, sql`, `);

  const statement = sql`
    UPDATE ${sql.raw(safeTable)} AS t
       SET ${setClause}
      FROM (VALUES ${valuesClause}) AS v(${valueListColumns})
     WHERE t.${sql.raw(safeKey)} = v.${sql.raw(safeKey)}
  `;

  const result = (await db.execute(statement)) as unknown as RawResult;
  return result.rowCount ?? 0;
}
