/**
 * Notification Application Service
 */

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RankNotificationService } from '../domain/services';
import { RANKING_DOMAIN_EVENT_BUS } from '@/modules/ranking';
import type { RankingDomainEventBusPort } from '@/modules/ranking';

@Injectable()
export class NotificationApplicationService implements OnModuleInit {
  constructor(
    private readonly rankNotificationService: RankNotificationService,
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(NotificationApplicationService.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.logger.info({
      event: 'notification_application_service_initialized',
    });
  }
}
