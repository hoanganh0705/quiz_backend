import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/core/database/database.module';
import { NotificationApplicationService } from './application/notification-application.service';
import { NotificationService } from './domain/notification.service';
import { NotificationRepository } from './infrastructure/repositories/notification.repository';
import { NotificationController } from './transport/controller/notification.controller';
import { NOTIFICATION_REPOSITORY_PORT } from './domain/ports/notification-ports';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [DatabaseModule, UserModule],
  providers: [
    NotificationApplicationService,
    NotificationService,
    NotificationRepository,
    { provide: NOTIFICATION_REPOSITORY_PORT, useExisting: NotificationRepository },
  ],
  controllers: [NotificationController],
  exports: [NotificationService, NotificationApplicationService],
})
export class NotificationModule {}
