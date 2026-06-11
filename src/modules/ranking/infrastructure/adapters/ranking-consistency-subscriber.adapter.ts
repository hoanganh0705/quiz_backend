/**
 * Ranking Consistency Check Subscriber
 *
 * Subscribes to internal ranking domain events and handles consistency check results.
 * Logs at appropriate severity levels and emits internal alerts for high-severity issues.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  RANKING_DOMAIN_EVENT_BUS,
  type RankingDomainEventBusPort,
} from '../../domain/ports/ranking-event-bus.port';
import type { ConsistencyCheckEvent } from '../../domain/events/ranking-domain.events';
import { getCorrelationId } from '@/common/interceptors/correlation-id';

interface ConsistencyAlertEvent {
  readonly eventType: 'consistency.alert';
  readonly issueCount: number;
  readonly issueType: string;
  readonly severity: 'medium' | 'high' | 'critical';
  readonly timestamp: Date;
  readonly correlationId: string | undefined;
}

@Injectable()
export class RankingConsistencySubscriber implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(RANKING_DOMAIN_EVENT_BUS)
    private readonly eventBus: RankingDomainEventBusPort,
    @InjectPinoLogger(RankingConsistencySubscriber.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.startListening();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private startListening(): void {
    this.unsubscribe = this.eventBus.subscribe((event) => {
      if (event.eventType === 'consistency.check') {
        this.handleConsistencyCheck(event);
      }
    });

    this.logger.info({
      event: 'consistency_subscriber_subscribed',
    });
  }

  private handleConsistencyCheck(event: ConsistencyCheckEvent): void {
    if (event.issuesFound === 0) {
      this.logger.debug({
        event: 'consistency_check_passed',
        issuesFound: event.issuesFound,
        issuesFixed: event.issuesFixed,
      });
      return;
    }

    const correlationId = getCorrelationId();

    if (event.issuesFound === 1) {
      this.logger.warn({
        event: 'consistency_issue_detected',
        issueCount: event.issuesFound,
        issuesFixed: event.issuesFixed,
        correlationId,
      });
      return;
    }

    // Multiple issues: treat as high severity (XP mismatches or rank gaps)
    this.logger.error({
      event: 'consistency_check_xp_mismatch',
      issueCount: event.issuesFound,
      issuesFixed: event.issuesFixed,
      severity: 'high',
      correlationId,
    });

    this.emitAlert({
      eventType: 'consistency.alert',
      issueCount: event.issuesFound,
      issueType: 'xp_mismatch',
      severity: 'high',
      timestamp: event.timestamp,
      correlationId,
    });
  }

  private emitAlert(alert: ConsistencyAlertEvent): void {
    // This fires an internal event that can be consumed by an external alerting
    // subscriber or webhook handler in a production system.
    // For now it logs at error so it appears in structured log aggregation.
    this.logger.error({
      event: 'consistency_alert_emitted',
      ...alert,
    });
  }
}
