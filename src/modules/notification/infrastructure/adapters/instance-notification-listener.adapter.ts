/**
 * Instance Notification Listener
 *
 * Subscribes to Instance domain events and dispatches notifications via InstanceNotificationService.
 * Handles: player joined, instance started, player XP earned, instance closed, player disconnected.
 *
 * Registered in NotificationModule.onModuleInit and unsubscribed on destroy.
 */

import { Inject, Injectable, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  INSTANCE_DOMAIN_EVENT_BUS,
  type InstanceDomainEventBusPort,
} from '@/modules/instance/domain/events';
import type { InstanceDomainEvent } from '@/modules/instance/domain/events';
import { InstanceNotificationService } from '../../domain/services/instance-notification.service';

@Injectable()
export class InstanceNotificationListener implements OnModuleInit, OnModuleDestroy {
  private unsubscribe: (() => void) | null = null;

  constructor(
    @Inject(forwardRef(() => INSTANCE_DOMAIN_EVENT_BUS))
    private readonly instanceEventBus: InstanceDomainEventBusPort,
    private readonly instanceNotificationService: InstanceNotificationService,
    @InjectPinoLogger(InstanceNotificationListener.name)
    private readonly logger: PinoLogger,
  ) {}

  onModuleInit(): void {
    this.subscribe();
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private subscribe(): void {
    this.unsubscribe = this.instanceEventBus.subscribe((event: unknown) => {
      void this.handleEvent(event as InstanceDomainEvent);
    });

    this.logger.info({
      event: 'instance_notification_listener_subscribed',
    });
  }

  private async handleEvent(event: InstanceDomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'instance.player_joined':
        await this.handlePlayerJoined(event);
        break;

      case 'instance.started':
        await this.handleInstanceStarted(event);
        break;

      case 'instance.player_xp_earned':
        await this.handlePlayerXpEarned(event);
        break;

      case 'instance.closed':
        await this.handleInstanceClosed(event);
        break;

      case 'instance.player_disconnected':
        await this.handlePlayerDisconnected(event);
        break;
    }
  }

  private async handlePlayerJoined(
    event: Extract<InstanceDomainEvent, { eventType: 'instance.player_joined' }>,
  ): Promise<void> {
    try {
      const instance = await this.getInstanceHostInfo(event.instanceId);
      if (!instance) {
        this.logger.warn({
          event: 'instance_player_joined_no_host',
          instanceId: event.instanceId,
        });
        return;
      }

      await this.instanceNotificationService.notifyPlayerJoined({
        hostUserId: instance.hostUserId,
        instanceId: event.instanceId,
        playerUserId: event.userId,
        playerName: instance.playerName ?? 'A player',
        totalPlayers: event.totalPlayers,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_player_joined_notification_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleInstanceStarted(
    event: Extract<InstanceDomainEvent, { eventType: 'instance.started' }>,
  ): Promise<void> {
    try {
      const instance = await this.getInstancePlayerIds(event.instanceId);
      if (!instance) {
        this.logger.warn({
          event: 'instance_started_no_players',
          instanceId: event.instanceId,
        });
        return;
      }

      await this.instanceNotificationService.notifyInstanceStarted({
        instanceId: event.instanceId,
        hostUserId: event.hostUserId,
        playerIds: instance.playerIds,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_started_notification_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handlePlayerXpEarned(
    event: Extract<InstanceDomainEvent, { eventType: 'instance.player_xp_earned' }>,
  ): Promise<void> {
    try {
      await this.instanceNotificationService.notifyPlayerXpEarned({
        userId: event.userId,
        instanceId: event.instanceId,
        xpEarned: event.xpEarned,
        newAllTimeXp: event.newAllTimeXp,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_xp_earned_notification_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handleInstanceClosed(
    event: Extract<InstanceDomainEvent, { eventType: 'instance.closed' }>,
  ): Promise<void> {
    try {
      const instance = await this.getInstancePlayerIds(event.instanceId);
      if (!instance) {
        this.logger.warn({
          event: 'instance_closed_no_players',
          instanceId: event.instanceId,
        });
        return;
      }

      await this.instanceNotificationService.notifyInstanceClosed({
        instanceId: event.instanceId,
        hostUserId: event.hostUserId,
        playerIds: instance.playerIds,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_closed_notification_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async handlePlayerDisconnected(
    event: Extract<InstanceDomainEvent, { eventType: 'instance.player_disconnected' }>,
  ): Promise<void> {
    try {
      await this.instanceNotificationService.notifyPlayerDisconnected({
        userId: event.userId,
        instanceId: event.instanceId,
        socketId: event.socketId,
      });
    } catch (error) {
      this.logger.error({
        event: 'instance_player_disconnected_notification_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getInstanceHostInfo(
    instanceId: string,
  ): Promise<{ hostUserId: string; playerName?: string } | null> {
    this.logger.debug({
      event: 'instance_host_lookup_stub',
      instanceId,
    });
    return Promise.resolve(null);
  }

  private getInstancePlayerIds(instanceId: string): Promise<{ playerIds: string[] } | null> {
    this.logger.debug({
      event: 'instance_player_ids_lookup_stub',
      instanceId,
    });
    return Promise.resolve(null);
  }
}
