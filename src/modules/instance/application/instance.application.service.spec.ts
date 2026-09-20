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
  let mockLogger: PinoLogger;

  beforeEach(() => {
    mockInstanceService = {
      getPlayerByUserAndInstance: jest.fn(),
      getInstanceById: jest.fn(),
    };
    mockMapper = {};
    mockEventBus = {
      emitPlayerAnswered: jest.fn(),
      subscribe: jest.fn().mockReturnValue(jest.fn()),
    };
    mockSocketRegistry = { consume: jest.fn() };
    mockAttemptAppService = { submitAnswer: jest.fn() };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as PinoLogger;

    service = new InstanceApplicationService(
      mockInstanceService as InstanceService,
      mockMapper as InstanceResponseMapper,
      mockEventBus as InstanceDomainEventBusPort,
      mockSocketRegistry as SocketConnectionRegistryPort,
      mockLogger,
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
  });
});
