/**
 * Phase 5 #3 — admin audit log search application service.
 *
 * Wraps the Drizzle `auth_audit_logs` table behind a
 * structured-search API. The query layer supports filters by
 * domain/action/eventType/userId/actorId/from/to and uses
 * offset pagination with a server-side cap.
 *
 * Why offset pagination and not cursor?
 * -------------------------------------
 * The audit log is bounded by `expiresAt` (default 90 days,
 * up to 365 for moderation). A cursor-based API would buy
 * little stability here — the retention job removes old rows
 * in the middle of a user's pagination — and the dataset is
 * small enough that an offset query is fast. The hard cap on
 * `limit` (100) keeps the page size bounded.
 *
 * Why a separate service and not extending `AuditLogService`?
 * ----------------------------------------------------------
 * `AuditLogService` is the *write* path: it inserts rows,
 * normalises metadata, and runs the retention purge. Adding a
 * search method there would mix read and write responsibilities
 * and double the surface of an otherwise small service. The
 * `AdminAuditSearchService` reads from the same table via its
 * own Drizzle executor.
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { authAuditLogs } from '@/core/database/schema';
import type { AdminAuditSearchQueryDto } from '../dto/admin-audit-search-query.dto';
import type { AdminAuditRowDto } from '../dto/admin-audit-row.dto';

@Injectable()
export class AdminAuditSearchService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async search(query: AdminAuditSearchQueryDto): Promise<{
    items: AdminAuditRowDto[];
    page: number;
    limit: number;
    total: number;
  }> {
    const limit = Math.min(query.limit ?? 50, 100);
    const page = Math.max(query.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const conditions = buildConditions(query);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          auditLogId: authAuditLogs.auditLogId,
          userId: authAuditLogs.userId,
          eventType: authAuditLogs.eventType,
          ipAddress: authAuditLogs.ipAddress,
          metadata: authAuditLogs.metadata,
          createdAt: authAuditLogs.createdAt,
        })
        .from(authAuditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(authAuditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(authAuditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    const items = rows.map((r) => ({
      auditLogId: r.auditLogId,
      userId: r.userId,
      eventType: r.eventType,
      ipAddress: r.ipAddress,
      metadata: (r.metadata as Record<string, unknown> | null) ?? {},
      createdAt: r.createdAt,
      // Structured fields are read out of the metadata column.
      domain: stringField(r.metadata, 'domain'),
      action: stringField(r.metadata, 'action'),
      actorId: stringField(r.metadata, 'actorId'),
      subjectUserId: stringField(r.metadata, 'subjectUserId'),
    }));

    return { items, page, limit, total: Number(total) };
  }
}

const buildConditions = (query: AdminAuditSearchQueryDto) => {
  const conditions: Array<ReturnType<typeof eq>> = [];
  if (query.eventType) {
    conditions.push(ilike(authAuditLogs.eventType, `%${query.eventType}%`));
  }
  if (query.userId) {
    conditions.push(eq(authAuditLogs.userId, query.userId));
  }
  if (query.from) {
    conditions.push(gte(authAuditLogs.createdAt, query.from));
  }
  if (query.to) {
    conditions.push(lte(authAuditLogs.createdAt, query.to));
  }
  // Domain / action / actorId live in `metadata`, so we filter
  // with JSONB containment (`@>`) which uses the GIN index
  // when present and is correct regardless of the surrounding
  // JSON shape.
  if (query.domain) {
    conditions.push(
      sql`${authAuditLogs.metadata} @> ${JSON.stringify({ domain: query.domain })}::jsonb`,
    );
  }
  if (query.action) {
    conditions.push(
      sql`${authAuditLogs.metadata} @> ${JSON.stringify({ action: query.action })}::jsonb`,
    );
  }
  if (query.actorId) {
    conditions.push(
      sql`${authAuditLogs.metadata} @> ${JSON.stringify({ actorId: query.actorId })}::jsonb`,
    );
  }
  return conditions;
};

const stringField = (
  metadata: unknown,
  key: string,
): string | null => {
  if (metadata === null || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
};