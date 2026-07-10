import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { HealthController } from './health.controller';
import { HealthPresenter } from './health.presenter';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthPresenter],
})
export class HealthModule {}
