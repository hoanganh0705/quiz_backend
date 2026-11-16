import { InstanceService } from './instance.service';
import { InstanceClosedEvent } from './events';
import { InstanceOptimisticLockError } from './errors';
import type { QuizInstanceRepositoryPort } from './ports';
import type { InstanceDomainEventBusPort } from './events';
import type { PinoLogger } from 'nestjs-pino';

describe('InstanceService — abandonInstanceByScheduler & leaveInstancePlayer', () => {
  let service: InstanceService;
  let mockRepo: jest.Mocked<QuizInstanceRepositoryPort>;
  let mockEventBus: jest.Mocked<InstanceDomainEventBusPort>;
  let mockLogger: jest.Mocked<PinoLogger>;

  beforeEach(() => {
    mockRepo = {
      getInstanceById: jest.fn(),
      countPlayers: jest.fn(),
      updateInstanceStatus: jest.fn(),
      updatePlayerStatus: jest.fn(),
    } as unknown as jest.Mocked<QuizInstanceRepositoryPort>;

    mockEventBus = {
      emitInstanceClosed: jest.fn(),
    } as unknown as jest.Mocked<InstanceDomainEventBusPort>;

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    service = new InstanceService(mockRepo, mockEventBus, mockLogger, undefined, {
      getQuizById: jest.fn(),
    } as any);
  });

  describe('abandonInstanceByScheduler', () => {
    it('returns not_found when instance does not exist', async () => {
      mockRepo.getInstanceById.mockResolvedValue(null);

      const result = await service.abandonInstanceByScheduler({
        instanceId: 'inst-nonexistent',
        expectedVersion: 1,
      });

      expect(result).toEqual({ abandoned: false, reason: 'not_found' });
      expect(mockRepo.updateInstanceStatus).not.toHaveBeenCalled();
      expect(mockEventBus.emitInstanceClosed).not.toHaveBeenCalled();
    });

    it('returns already_closed when instance status is closed', async () => {
      mockRepo.getInstanceById.mockResolvedValue({
        instanceId: 'inst-1',
        status: 'closed',
        version: 2,
        hostUserId: 'host-1',
      } as any);

      const result = await service.abandonInstanceByScheduler({
        instanceId: 'inst-1',
        expectedVersion: 2,
      });

      expect(result).toEqual({ abandoned: false, reason: 'already_closed' });
      expect(mockRepo.updateInstanceStatus).not.toHaveBeenCalled();
    });

    it('returns already_closed when instance status is finished', async () => {
      mockRepo.getInstanceById.mockResolvedValue({
        instanceId: 'inst-1',
        status: 'finished',
        version: 3,
        hostUserId: 'host-1',
      } as any);

      const result = await service.abandonInstanceByScheduler({
        instanceId: 'inst-1',
        expectedVersion: 3,
      });

      expect(result).toEqual({ abandoned: false, reason: 'already_closed' });
      expect(mockRepo.updateInstanceStatus).not.toHaveBeenCalled();
    });

    it('returns players_joined when active players > 0', async () => {
      mockRepo.getInstanceById.mockResolvedValue({
        instanceId: 'inst-1',
        status: 'open',
        version: 1,
        hostUserId: 'host-1',
      } as any);
      mockRepo.countPlayers.mockResolvedValue(2);

      const result = await service.abandonInstanceByScheduler({
        instanceId: 'inst-1',
        expectedVersion: 1,
      });

      expect(result).toEqual({ abandoned: false, reason: 'players_joined' });
      expect(mockRepo.updateInstanceStatus).not.toHaveBeenCalled();
    });

    it('successfully closes instance when active players is 0', async () => {
      mockRepo.getInstanceById.mockResolvedValue({
        instanceId: 'inst-1',
        status: 'open',
        version: 1,
        hostUserId: 'host-1',
      } as any);
      mockRepo.countPlayers.mockResolvedValue(0);
      mockRepo.updateInstanceStatus.mockResolvedValue({ version: 2 });

      const result = await service.abandonInstanceByScheduler({
        instanceId: 'inst-1',
        expectedVersion: 1,
      });

      expect(result.abandoned).toBe(true);
      if (result.abandoned) {
        expect(result.status).toBe('closed');
        expect(typeof result.closedAt).toBe('string');
      }

      expect(mockRepo.updateInstanceStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceId: 'inst-1',
          status: 'closed',
          countdownStartedAt: null,
          expectedVersion: 1,
        }),
      );

      expect(mockEventBus.emitInstanceClosed).toHaveBeenCalledWith(expect.any(InstanceClosedEvent));
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'instance_abandoned_auto_closed',
          instanceId: 'inst-1',
        }),
      );
    });

    it('returns lost_lock when optimistic lock error occurs', async () => {
      mockRepo.getInstanceById.mockResolvedValue({
        instanceId: 'inst-1',
        status: 'open',
        version: 1,
        hostUserId: 'host-1',
      } as any);
      mockRepo.countPlayers.mockResolvedValue(0);
      mockRepo.updateInstanceStatus.mockRejectedValue(new InstanceOptimisticLockError());

      const result = await service.abandonInstanceByScheduler({
        instanceId: 'inst-1',
        expectedVersion: 1,
      });

      expect(result).toEqual({ abandoned: false, reason: 'lost_lock' });
      expect(mockEventBus.emitInstanceClosed).not.toHaveBeenCalled();
    });
  });

  describe('leaveInstancePlayer', () => {
    it('updates player status to disconnected', async () => {
      mockRepo.updatePlayerStatus.mockResolvedValue(undefined);

      await service.leaveInstancePlayer({
        instanceId: 'inst-1',
        userId: 'user-1',
      });

      expect(mockRepo.updatePlayerStatus).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        userId: 'user-1',
        status: 'disconnected',
      });
    });
  });
});
