import { InstanceApplicationService } from './instance.application.service';
import { InstanceService } from '../domain/instance.service';
import { InstanceResponseMapper } from '../mappers/instance-response.mapper';
import type { InstanceDomainEventBusPort } from '../domain/events';
import type { SocketConnectionRegistryPort } from '../domain/ports';
import { AttemptApplicationService } from '@/modules/attempt/application/attempt.application.service';
import { PinoLogger } from 'nestjs-pino';

describe('InstanceApplicationService', () => {
  let service: InstanceApplicationService;
  let mockInstanceService: Partial<InstanceService>;
  let mockMapper: Partial<InstanceResponseMapper>;
  let mockEventBus: Partial<InstanceDomainEventBusPort>;
  let mockSocketRegistry: Partial<SocketConnectionRegistryPort>;
  let mockAttemptAppService: Partial<AttemptApplicationService>;
  let mockLogger: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(() => {
    mockInstanceService = {
      getPlayerByUserAndInstance: jest.fn().mockResolvedValue({ status: 'active' }),
      getInstanceById: jest.fn(),
      countPlayers: jest.fn().mockResolvedValue(0),
      notifyHostPlayerDisconnected: jest.fn().mockResolvedValue(undefined),
      leaveInstancePlayer: jest.fn().mockResolvedValue(undefined),
      eliminateInstance: jest.fn().mockResolvedValue(undefined),
    };
    mockMapper = {};
    mockEventBus = {
      emitPlayerAnswered: jest.fn(),
      emitPlayerDisconnected: jest.fn(),
      subscribe: jest.fn().mockReturnValue(jest.fn()),
    };
    mockSocketRegistry = { consume: jest.fn(), record: jest.fn() };
    mockAttemptAppService = { submitAnswer: jest.fn() };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new InstanceApplicationService(
      mockInstanceService as InstanceService,
      mockMapper as InstanceResponseMapper,
      mockEventBus as InstanceDomainEventBusPort,
      mockSocketRegistry as SocketConnectionRegistryPort,
      mockLogger as unknown as PinoLogger,
      mockAttemptAppService as AttemptApplicationService,
    );
  });

  describe('handleAnswerSubmittedSocket', () => {
    const user = { sub: 'user-1', role: 'user' } as never;
    const data = {
      instanceId: 'inst-1',
      questionId: 'q-1',
      selectedOptionId: 'opt-1',
      timeTakenMs: 5000,
    };

    it('returns NOT_IN_INSTANCE when player not in instance', async () => {
      (mockInstanceService.getPlayerByUserAndInstance as jest.Mock).mockResolvedValue(null);

      const result = await service.handleAnswerSubmittedSocket(data, user);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('NOT_IN_INSTANCE');
      expect(result.attemptId).toBe('');
    });

    it('returns ATTEMPT_NOT_READY when player has no attemptId', async () => {
      (mockInstanceService.getPlayerByUserAndInstance as jest.Mock).mockResolvedValue({
        instancePlayerId: 'p-1',
        attemptId: null,
      });

      const result = await service.handleAnswerSubmittedSocket(data, user);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('ATTEMPT_NOT_READY');
      expect(result.attemptId).toBe('');
    });

    it('returns INSTANCE_NOT_RUNNING when instance is not running', async () => {
      (mockInstanceService.getPlayerByUserAndInstance as jest.Mock).mockResolvedValue({
        instancePlayerId: 'p-1',
        attemptId: 'att-1',
      });
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        status: 'countdown',
      });

      const result = await service.handleAnswerSubmittedSocket(data, user);

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe('INSTANCE_NOT_RUNNING');
      expect(result.attemptId).toBe('att-1');
    });

    it('accepts answer and returns attemptId when player is valid and instance is running', async () => {
      (mockInstanceService.getPlayerByUserAndInstance as jest.Mock).mockResolvedValue({
        instancePlayerId: 'p-1',
        attemptId: 'att-1',
      });
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        status: 'running',
      });
      (mockAttemptAppService.submitAnswer as jest.Mock).mockResolvedValue({});

      const result = await service.handleAnswerSubmittedSocket(data, user);

      expect(result.accepted).toBe(true);
      expect(result.attemptId).toBe('att-1');
      expect(mockAttemptAppService.submitAnswer).toHaveBeenCalledWith(
        'att-1',
        'q-1',
        'opt-1',
        5000,
        user,
      );
      expect(mockEventBus.emitPlayerAnswered).toHaveBeenCalled();
    });
  });

  describe('handlePlayerJoinedSocket', () => {
    it('returns instance status and quiz title', async () => {
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        status: 'open',
        quizTitle: 'Test Quiz',
      });

      const result = await service.handleJoinInstanceSocket('inst-1', {} as never);

      expect(result.status).toBe('open');
      expect(result.quizTitle).toBe('Test Quiz');
    });
  });

  describe('notifyHostPlayerDisconnected (via handlePlayerLeftSocket)', () => {
    it('logs error when consume fails', async () => {
      const error = new Error('Redis connection failed');
      (mockSocketRegistry.consume as jest.Mock).mockRejectedValue(error);

      await service.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-1' });

      const errorCall = mockLogger.error.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expect(errorCall?.['event']).toBe('socket_consume_failed');
      expect(errorCall?.['error']).toBe('Redis connection failed');
    });

    it('returns early when no meta found', async () => {
      (mockSocketRegistry.consume as jest.Mock).mockResolvedValue(null);

      await service.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-1' });

      expect(mockEventBus.emitPlayerAnswered).not.toHaveBeenCalled();
    });

    it('marks player as disconnected and notifies host when meta is found', async () => {
      (mockSocketRegistry.consume as jest.Mock).mockResolvedValue({
        instanceId: 'inst-1',
        userId: 'user-1',
      });
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        hostUserId: 'host-1',
      });

      await service.handlePlayerLeftSocket({ socketId: 'sock-1', instanceId: 'inst-1' });

      expect(mockInstanceService.leaveInstancePlayer).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        userId: 'user-1',
      });
    });
  });

  describe('real-time active socket count & listInstancesForController', () => {
    it('returns 0 when server is not set', () => {
      expect(service.getActiveRoomSocketCount('inst-1')).toBe(0);
    });

    it('returns socket count from adapter rooms when namespace server is set', () => {
      const mockRooms = new Map<string, Set<string>>();
      mockRooms.set('inst-1', new Set(['sock-a', 'sock-b']));
      const mockServer = {
        adapter: {
          rooms: mockRooms,
        },
      } as any;

      service.setServer(mockServer);

      expect(service.getActiveRoomSocketCount('inst-1')).toBe(2);
      expect(service.getActiveRoomSocketCount('inst-empty')).toBe(0);
    });

    it('passes real-time activeCount to mapper in listInstancesForController', async () => {
      const mockRooms = new Map<string, Set<string>>();
      mockRooms.set('inst-active', new Set(['s1']));
      service.setServer({
        adapter: { rooms: mockRooms },
      } as any);

      (mockInstanceService as any).listInstances = jest.fn().mockResolvedValue({
        rows: [
          { instanceId: 'inst-active', playerCount: 10 },
          { instanceId: 'inst-empty', playerCount: 5 },
        ],
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      });

      mockMapper.toInstanceListItemResponse = jest.fn().mockImplementation((row, activeCount) => ({
        instanceId: row.instanceId,
        playerCount: activeCount,
      })) as any;

      const result = await service.listInstancesForController({ limit: 10 });

      expect(mockMapper.toInstanceListItemResponse).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'inst-active' }),
        1,
      );
      expect(mockMapper.toInstanceListItemResponse).toHaveBeenCalledWith(
        expect.objectContaining({ instanceId: 'inst-empty' }),
        0,
      );
      expect(result.items[0]?.playerCount).toBe(1);
      expect(result.items[1]?.playerCount).toBe(0);
    });
  });

  describe('getInstanceByIdForController auto-abandonment', () => {
    it('auto-abandons idle instances older than 5 minutes with 0 sockets', async () => {
      const pastTtlDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      (mockInstanceService.getInstanceById as jest.Mock)
        .mockResolvedValueOnce({
          instanceId: 'inst-idle',
          status: 'open',
          version: 1,
          updatedAt: pastTtlDate,
        })
        .mockResolvedValueOnce({
          instanceId: 'inst-idle',
          status: 'closed',
          version: 2,
          updatedAt: new Date().toISOString(),
        });
      (mockInstanceService as any).disconnectPlayersByInstance = jest.fn().mockResolvedValue(undefined);
      (mockInstanceService as any).abandonInstanceByScheduler = jest.fn().mockResolvedValue({
        abandoned: true,
        status: 'closed',
      });
      (mockInstanceService as any).listInstancePlayers = jest.fn().mockResolvedValue({
        items: [],
      });
      mockMapper.toInstanceDetailResponse = jest.fn().mockReturnValue({
        instanceId: 'inst-idle',
        status: 'closed',
        players: [],
      }) as any;

      service.setServer({
        adapter: { rooms: new Map() },
      } as any);

      const result = await service.getInstanceByIdForController('inst-idle');

      expect((mockInstanceService as any).disconnectPlayersByInstance).toHaveBeenCalledWith('inst-idle');
      expect((mockInstanceService as any).abandonInstanceByScheduler).toHaveBeenCalledWith({
        instanceId: 'inst-idle',
        expectedVersion: 1,
      });
      expect(result.status).toBe('closed');
    });

    it('eliminates instance when host is disconnected in open lobby', async () => {
      (mockInstanceService.getInstanceById as jest.Mock)
        .mockResolvedValueOnce({
          instanceId: 'inst-host-dc',
          status: 'open',
          hostUserId: 'host-1',
          version: 1,
          updatedAt: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          instanceId: 'inst-host-dc',
          status: 'closed',
          hostUserId: 'host-1',
          version: 2,
          updatedAt: new Date().toISOString(),
        });
      (mockInstanceService.getPlayerByUserAndInstance as jest.Mock).mockResolvedValue({
        status: 'disconnected',
      });
      (mockInstanceService as any).listInstancePlayers = jest.fn().mockResolvedValue({ items: [] });
      mockMapper.toInstanceDetailResponse = jest.fn().mockReturnValue({
        instanceId: 'inst-host-dc',
        status: 'closed',
        players: [],
      }) as any;

      const result = await service.getInstanceByIdForController('inst-host-dc');

      expect(mockInstanceService.eliminateInstance).toHaveBeenCalledWith('inst-host-dc', 'host-1');
      expect(result.status).toBe('closed');
    });
  });

  describe('handlePlayerLeftSocket', () => {
    it('eliminates instance when host leaves open lobby', async () => {
      (mockSocketRegistry.consume as jest.Mock).mockResolvedValue({
        instanceId: 'inst-host-leave',
        userId: 'host-123',
      });
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        instanceId: 'inst-host-leave',
        hostUserId: 'host-123',
        status: 'open',
      });

      await service.handlePlayerLeftSocket({
        socketId: 'sock-1',
        instanceId: 'inst-host-leave',
      });

      expect(mockInstanceService.eliminateInstance).toHaveBeenCalledWith(
        'inst-host-leave',
        'host-123',
      );
      expect(mockInstanceService.leaveInstancePlayer).not.toHaveBeenCalled();
    });

    it('schedules elimination with grace period when isExplicitLeave is false and cancels on rejoin', async () => {
      jest.useFakeTimers();
      (mockSocketRegistry.consume as jest.Mock).mockResolvedValue({
        instanceId: 'inst-grace',
        userId: 'host-123',
      });
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        instanceId: 'inst-grace',
        hostUserId: 'host-123',
        status: 'open',
      });

      await service.handlePlayerLeftSocket({
        socketId: 'sock-grace',
        instanceId: 'inst-grace',
        isExplicitLeave: false,
      });

      expect(mockInstanceService.eliminateInstance).not.toHaveBeenCalled();

      // Host rejoins within grace period
      service.handlePlayerJoinedSocket({
        socketId: 'sock-new',
        instanceId: 'inst-grace',
        user: { sub: 'host-123' } as any,
      });

      jest.advanceTimersByTime(6000);

      expect(mockInstanceService.eliminateInstance).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('eliminates instance when grace period timer expires', async () => {
      jest.useFakeTimers();
      (mockSocketRegistry.consume as jest.Mock).mockResolvedValue({
        instanceId: 'inst-expire',
        userId: 'host-123',
      });
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        instanceId: 'inst-expire',
        hostUserId: 'host-123',
        status: 'open',
      });

      await service.handlePlayerLeftSocket({
        socketId: 'sock-expire',
        instanceId: 'inst-expire',
        isExplicitLeave: false,
      });

      expect(mockInstanceService.eliminateInstance).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(20000);

      expect(mockInstanceService.eliminateInstance).toHaveBeenCalledWith(
        'inst-expire',
        'host-123',
      );
      jest.useRealTimers();
    });

    it('disconnects regular player when non-host leaves', async () => {
      (mockSocketRegistry.consume as jest.Mock).mockResolvedValue({
        instanceId: 'inst-guest-leave',
        userId: 'guest-456',
      });
      (mockInstanceService.getInstanceById as jest.Mock).mockResolvedValue({
        instanceId: 'inst-guest-leave',
        hostUserId: 'host-123',
        status: 'open',
      });

      await service.handlePlayerLeftSocket({
        socketId: 'sock-2',
        instanceId: 'inst-guest-leave',
      });

      expect(mockInstanceService.eliminateInstance).not.toHaveBeenCalled();
      expect(mockInstanceService.leaveInstancePlayer).toHaveBeenCalledWith({
        instanceId: 'inst-guest-leave',
        userId: 'guest-456',
      });
    });
  });
});
