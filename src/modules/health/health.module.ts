import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { EmailModule } from '@/modules/email/email.module';
import { StorageModule } from '@/core/storage/storage.module';
import { HealthController } from './health.controller';
import { HealthPresenter } from './health.presenter';
import { HealthQueueProbe } from './health-queue-probe';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [DatabaseModule, EmailModule, StorageModule],
  controllers: [HealthController, MetricsController],
  providers: [HealthPresenter, HealthQueueProbe],
})
export class HealthModule {}