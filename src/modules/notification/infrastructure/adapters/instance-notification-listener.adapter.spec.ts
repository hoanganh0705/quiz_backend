/* eslint-disable @typescript-eslint/unbound-method */
import type { PinoLogger } from 'nestjs-pino';
import { InstanceNotificationListener } from './instance-notification-listener.adapter';
import type { InstanceDomainEventBusPort } from '@/modules/instance/domain/events';
import type { InstanceNotificationService } from '../../domain/services/instance-notification.service';
import type { QuizInstanceRepositoryPort } from '@/modules/instance/domain/ports/instance-repository.port';

function makeLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
  } as unknown as PinoLogger;
}

function makeService() {
  const handlers: Array<(event: unknown) => unknown> = [];
  const unsubscribe = jest.fn();
  const instanceEventBus: InstanceDomainEventBusPort = {
    subscribe: jest.fn((handler: (event: unknown) => void) => {
      handlers.push(handler);
      return unsubscribe;
    }),
  };
  const instanceNotificationService = {
    notifyPlayerJoined: jest.fn().mockResolvedValue(undefined),
    notifyInstanceStarted: jest.fn().mockResolvedValue(undefined),
    notifyPlayerXpEarned: jest.fn().mockResolvedValue(undefined),
    notifyInstanceClosed: jest.fn().mockResolvedValue(undefined),
    notifyPlayerDisconnected: jest.fn().mockResolvedValue(undefined),
  } as unknown as InstanceNotificationService;

  const instanceRepository: QuizInstanceRepositoryPort = {
    getInstanceDetailById: jest.fn().mockResolvedValue({
      hostUserId: 'host-1',
      hostUsername: 'host_user',
      hostDisplayName: 'Host User',
    }),
    listPlayersWithProfile: jest.fn().mockResolvedValue({
      items: [{ userId: 'p-1' }, { userId: 'p-2' }],
    }),
  } as unknown as QuizInstanceRepositoryPort;

  const listener = new InstanceNotificationListener(
    instanceEventBus,
    instanceNotificationService,
    instanceRepository,
    makeLogger(),
  );
  listener.onModuleInit();
  return { listener, handlers, instanceNotificationService, instanceRepository, unsubscribe };
}

describe('InstanceNotificationListener', () => {
  async function dispatch(handler: (e: unknown) => unknown, event: unknown): Promise<void> {
    handler(event);
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('notifies host when a player joins', async () => {
    const { handlers, instanceNotificationService, instanceRepository } = makeService();
    await dispatch(handlers[0], {
      eventType: 'instance.player_joined',
      instanceId: 'inst-1',
      userId: 'p-1',
      totalPlayers: 3,
    });
    expect(instanceRepository.getInstanceDetailById).toHaveBeenCalledWith('inst-1');
    expect(instanceNotificationService.notifyPlayerJoined).toHaveBeenCalledWith(
      expect.objectContaining({
        hostUserId: 'host-1',
        playerUserId: 'p-1',
        totalPlayers: 3,
      }),
    );
  });

  it('warns and exits if host info is missing', async () => {
    const { handlers, instanceNotificationService, instanceRepository } = makeService();
    (instanceRepository.getInstanceDetailById as jest.Mock).mockResolvedValueOnce(null);
    await dispatch(handlers[0], {
      eventType: 'instance.player_joined',
      instanceId: 'inst-1',
      userId: 'p-1',
      totalPlayers: 1,
    });
    expect(instanceNotificationService.notifyPlayerJoined).not.toHaveBeenCalled();
  });

  it('notifies all players when the instance starts', async () => {
    const { handlers, instanceNotificationService } = makeService();
    await dispatch(handlers[0], {
      eventType: 'instance.started',
      instanceId: 'inst-1',
      hostUserId: 'host-1',
    });
    expect(instanceNotificationService.notifyInstanceStarted).toHaveBeenCalledWith({
      instanceId: 'inst-1',
      hostUserId: 'host-1',
      playerIds: ['p-1', 'p-2'],
    });
  });

  it('notifies a single player about XP earned', async () => {
    const { handlers, instanceNotificationService } = makeService();
    await dispatch(handlers[0], {
      eventType: 'instance.player_xp_earned',
      instanceId: 'inst-1',
      userId: 'p-1',
      xpEarned: 50,
      newAllTimeXp: 250,
    });
    expect(instanceNotificationService.notifyPlayerXpEarned).toHaveBeenCalledWith({
      userId: 'p-1',
      instanceId: 'inst-1',
      xpEarned: 50,
      newAllTimeXp: 250,
    });
  });

  it('notifies all players when the instance closes', async () => {
    const { handlers, instanceNotificationService } = makeService();
    await dispatch(handlers[0], {
      eventType: 'instance.closed',
      instanceId: 'inst-1',
      hostUserId: 'host-1',
    });
    expect(instanceNotificationService.notifyInstanceClosed).toHaveBeenCalledWith({
      instanceId: 'inst-1',
      hostUserId: 'host-1',
      playerIds: ['p-1', 'p-2'],
    });
  });

  it('notifies a player about disconnection', async () => {
    const { handlers, instanceNotificationService } = makeService();
    await dispatch(handlers[0], {
      eventType: 'instance.player_disconnected',
      instanceId: 'inst-1',
      userId: 'p-1',
      socketId: 'sock-1',
    });
    expect(instanceNotificationService.notifyPlayerDisconnected).toHaveBeenCalledWith({
      userId: 'p-1',
      instanceId: 'inst-1',
      socketId: 'sock-1',
    });
  });

  it('handles instance.player_answered as a no-op (no notifications)', async () => {
    const { handlers, instanceNotificationService } = makeService();
    await dispatch(handlers[0], {
      eventType: 'instance.player_answered',
      instanceId: 'inst-1',
      userId: 'p-1',
      questionIndex: 1,
      isCorrect: true,
    });
    expect(instanceNotificationService.notifyPlayerJoined).not.toHaveBeenCalled();
    expect(instanceNotificationService.notifyPlayerXpEarned).not.toHaveBeenCalled();
  });

  it('logs and continues when host info lookup throws', async () => {
    const { handlers, instanceNotificationService, instanceRepository } = makeService();
    (instanceRepository.getInstanceDetailById as jest.Mock).mockRejectedValueOnce(new Error('db'));
    await dispatch(handlers[0], {
      eventType: 'instance.player_joined',
      instanceId: 'inst-1',
      userId: 'p-1',
      totalPlayers: 1,
    });
    expect(instanceNotificationService.notifyPlayerJoined).not.toHaveBeenCalled();
  });

  it('warns and exits instance.started when there are no players', async () => {
    const { handlers, instanceNotificationService, instanceRepository } = makeService();
    (instanceRepository.listPlayersWithProfile as jest.Mock).mockResolvedValueOnce({ items: [] });
    await dispatch(handlers[0], {
      eventType: 'instance.started',
      instanceId: 'inst-1',
      hostUserId: 'host-1',
    });
    expect(instanceNotificationService.notifyInstanceStarted).not.toHaveBeenCalled();
  });

  it('unsubscribes on module destroy', () => {
    const { listener, unsubscribe } = makeService();
    listener.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
