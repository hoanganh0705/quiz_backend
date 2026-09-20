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
