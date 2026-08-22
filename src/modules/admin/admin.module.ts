/**
 * Phase 5 #3 — admin module.
 *
 * Owns admin-only endpoints. The first endpoint is the audit
 * log search (`GET /admin/audit/search`); the module is
 * structured so future admin endpoints (coins adjust, ranking
 * inspect, achievement admin, etc.) can drop in alongside.
 *
 * Phase 7 #4 — also hosts the nightly soft-delete purge job
 * (`SoftDeletePurgeService`). The service runs as an internal
 * `@Cron`-driven background process; no controller is required.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditSearchService } from './application/admin-audit-search.service';
import { SoftDeletePurgeService } from './infrastructure/soft-delete-purge.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminAuditController],
  providers: [AdminAuditSearchService, SoftDeletePurgeService],
})
export class AdminModule {}