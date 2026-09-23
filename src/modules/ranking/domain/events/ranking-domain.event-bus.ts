import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { BaseDomainEventBus } from '@/common/events/base-domain-event-bus';
import type {
  XpAddedEvent,
  RankChangedEvent,
  PeakRankAchievedEvent,
  PeriodResetInitiatedEvent,
  PeriodResetCompletedEvent,
  RankingMilestoneEvent,
  ConsistencyCheckEvent,
  RankingDomainEvent,
} from './ranking-domain.events';
import { RankingDomainEventBusPort } from '../ports';

@Injectable()
export class RankingDomainEventBus
  extends BaseDomainEventBus<RankingDomainEvent>
  implements RankingDomainEventBusPort
{
  constructor(
    @InjectPinoLogger(RankingDomainEventBus.name)
    logger: PinoLogger,
  ) {
    super(logger, { logEventName: 'ranking_event' });
  }

  subscribe(handler: (event: RankingDomainEvent) => void): () => void {
    return super.subscribe(handler);
  }

  dispatchToSubscribers(event: RankingDomainEvent): void {
    super.dispatchToSubscribers(event);
  }

  emitXpAdded(event: XpAddedEvent): void {
    this.dispatch(event);
  }

  emitRankChanged(event: RankChangedEvent): void {
    this.dispatch(event);
  }

  emitPeakRankAchieved(event: PeakRankAchievedEvent): void {
    this.dispatch(event);
  }

  emitPeriodResetInitiated(event: PeriodResetInitiatedEvent): void {
    this.dispatch(event);
  }

  emitPeriodResetCompleted(event: PeriodResetCompletedEvent): void {
    this.dispatch(event);
  }

  emitRankingMilestone(event: RankingMilestoneEvent): void {
    this.dispatch(event);
  }

  emitConsistencyCheck(event: ConsistencyCheckEvent): void {
    this.dispatch(event);
  }
}
