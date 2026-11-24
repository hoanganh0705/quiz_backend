---
name: nestjs-drizzle-postgres
description: Designs PostgreSQL schemas, Drizzle ORM queries, migrations, transactions, indexes, and repository adapters in NestJS. Use for database changes, persistence code, and query optimization.
---

# NestJS + Drizzle + PostgreSQL

Treat PostgreSQL as the source of data integrity. Drizzle is the typed query layer, not a replacement for database constraints.

## First inspect
Check Drizzle version, driver, schema organization, migration scripts, naming conventions, database provider, and existing transaction/repository patterns.

## Schema and migration rules
- Define primary keys, foreign keys, unique constraints, check constraints, and nullability deliberately.
- Add indexes based on actual query predicates, joins, ordering, and uniqueness requirements.
- For many-to-many tables, consider indexes on each foreign key and composites matching access patterns.
- Make migrations explicit, review generated SQL, and preserve existing data.
- Never use destructive schema push/drop/rename in production without an explicit migration and approved data plan.
- Do not edit historical migrations that may already have been applied; create a new migration.

## Query rules
- Select only required columns; avoid loading entire rows by default.
- Use parameterized Drizzle queries; never concatenate untrusted input into raw SQL.
- Use transactions when multiple writes must succeed or fail together.
- Keep transactions short; do not perform network calls inside them.
- Use database constraints to protect invariants under concurrency.
- Use deterministic pagination; consider cursor pagination for large/changing datasets.
- Inspect query plans before claiming an index improves performance.
- Avoid N+1 patterns and unbounded result sets.

## Verification
Review migration SQL and test rollback, constraints, nullability, uniqueness, foreign-key behavior, and query edge cases.
