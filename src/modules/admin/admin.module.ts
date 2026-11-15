import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditSearchService } from './application/admin-audit-search.service';
import { SoftDeletePurgeService } from './infrastructure/soft-delete-purge.service';
import { AdminUserController } from './admin-user.controller';
import { AdminUserService } from './application/admin-user.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminAuditController, AdminUserController],
  providers: [AdminAuditSearchService, AdminUserService, SoftDeletePurgeService],
  exports: [AdminUserService],
})
export class AdminModule {}
