import type {
  InstanceCreatedEvent,
  PlayerJoinedEvent,
  PlayerAttemptStartedEvent,
  PlayerXpEarnedEvent,
  PlayerFinishedEvent,
  PlayerDisconnectedEvent,
  InstanceStartedEvent,
  InstanceClosedEvent,
} from './instance-domain.events';

export const INSTANCE_DOMAIN_EVENT_BUS = Symbol('INSTANCE_DOMAIN_EVENT_BUS');

export type InstanceEventHandler = (event: unknown) => void;

export interface InstanceDomainEventBusPort {
  subscribe(handler: InstanceEventHandler): () => void;

  emitInstanceCreated(event: InstanceCreatedEvent): void;
  emitPlayerJoined(event: PlayerJoinedEvent): void;
  emitPlayerAttemptStarted(event: PlayerAttemptStartedEvent): void;
  emitPlayerXpEarned(event: PlayerXpEarnedEvent): void;
  emitPlayerFinished(event: PlayerFinishedEvent): void;
  emitPlayerDisconnected(event: PlayerDisconnectedEvent): void;
  emitInstanceStarted(event: InstanceStartedEvent): void;
  emitInstanceClosed(event: InstanceClosedEvent): void;
}
