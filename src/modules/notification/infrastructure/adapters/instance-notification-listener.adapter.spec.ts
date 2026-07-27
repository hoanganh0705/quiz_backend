/**
 * InstanceNotificationListener unit tests.
 *
 * Tests the listener adapter methods:
 *   - `handlePlayerJoined` — notifies host when player joins
 *   - `handleInstanceStarted` — notifies all players when instance starts
 *   - `handlePlayerXpEarned` — notifies player of XP earned
 *   - `handleInstanceClosed` — notifies all players when instance closes
 *   - `handlePlayerDisconnected` — notifies player of disconnection
 */
import { InstanceNotificationListener } from './instance-notification-listener.adapter';
import {
  PlayerJoinedEvent,
  InstanceStartedEvent,
  PlayerXpEarnedEvent,
  InstanceClosedEvent,
  PlayerDisconnectedEvent,
} from '@/modules/instance/domain/events';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as unknown as jest.Mocked<{
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
}>;

const createMockEventBus = () => ({
  subscribe: jest.fn().mockReturnValue(jest.fn()),
});

const createMockInstanceRepository = () => ({
  getInstanceDetailById: jest.fn(),
  listPlayersWithProfile: jest.fn(),
});

const createMockNotificationService = () => ({
  notifyPlayerJoined: jest.fn(),
  notifyInstanceStarted: jest.fn(),
  notifyPlayerXpEarned: jest.fn(),
  notifyInstanceClosed: jest.fn(),
  notifyPlayerDisconnected: jest.fn(),
});

describe('InstanceNotificationListener', () => {
  let mockEventBus: ReturnType<typeof createMockEventBus>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockInstanceRepository: ReturnType<typeof createMockInstanceRepository>;
  let listener: InstanceNotificationListener;

  beforeEach(() => {
    mockEventBus = createMockEventBus();
    mockNotificationService = createMockNotificationService();
    mockInstanceRepository = createMockInstanceRepository();

    listener = new InstanceNotificationListener(
      mockEventBus as never,
      mockNotificationService as never,
      mockInstanceRepository as never,
      mockLogger,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('subscribes to instance event bus', () => {
      listener.onModuleInit();

      expect(mockEventBus.subscribe).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('cleans up subscription', () => {
      const unsubscribe = jest.fn();
      mockEventBus.subscribe.mockReturnValue(unsubscribe);

      listener.onModuleInit();
      listener.onModuleDestroy();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('handlePlayerJoined', () => {
    it('notifies host when player joins', async () => {
      mockInstanceRepository.getInstanceDetailById.mockResolvedValue({
        hostUserId: 'host-1',
        hostUsername: 'hostuser',
        hostDisplayName: 'Host User',
      });

      const event = new PlayerJoinedEvent('instance-1', 'player-1', 2, new Date().toISOString());
      await listener['handlePlayerJoined'](event);

      expect(mockNotificationService.notifyPlayerJoined).toHaveBeenCalledWith({
        hostUserId: 'host-1',
        instanceId: 'instance-1',
        playerUserId: 'player-1',
        playerName: 'Host User',
        totalPlayers: 2,
      });
    });

    it('uses hostUsername when displayName is null', async () => {
      mockInstanceRepository.getInstanceDetailById.mockResolvedValue({
        hostUserId: 'host-1',
        hostUsername: 'hostuser',
        hostDisplayName: null,
      });

      const event = new PlayerJoinedEvent('instance-1', 'player-1', 2, new Date().toISOString());
      await listener['handlePlayerJoined'](event);

      expect(mockNotificationService.notifyPlayerJoined).toHaveBeenCalledWith(
        expect.objectContaining({ playerName: 'hostuser' }),
      );
    });

    it('logs warning when instance not found', async () => {
      mockInstanceRepository.getInstanceDetailById.mockResolvedValue(null);

      const event = new PlayerJoinedEvent('nonexistent', 'player-1', 1, new Date().toISOString());
      await listener['handlePlayerJoined'](event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_player_joined_no_host' }),
      );
      expect(mockNotificationService.notifyPlayerJoined).not.toHaveBeenCalled();
    });

    it('logs error when notification fails', async () => {
      mockInstanceRepository.getInstanceDetailById.mockResolvedValue({
        hostUserId: 'host-1',
        hostUsername: 'hostuser',
        hostDisplayName: 'Host',
      });
      mockNotificationService.notifyPlayerJoined.mockRejectedValue(new Error('Failed'));

      const event = new PlayerJoinedEvent('instance-1', 'player-1', 2, new Date().toISOString());
      await listener['handlePlayerJoined'](event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_player_joined_notification_failed' }),
      );
    });
  });

  describe('handleInstanceStarted', () => {
    it('notifies all players when instance starts', async () => {
      mockInstanceRepository.listPlayersWithProfile.mockResolvedValue([
        { userId: 'player-1' },
        { userId: 'player-2' },
      ]);

      const event = new InstanceStartedEvent('instance-1', 'host-1', new Date().toISOString());
      await listener['handleInstanceStarted'](event);

      expect(mockNotificationService.notifyInstanceStarted).toHaveBeenCalledWith({
        instanceId: 'instance-1',
        hostUserId: 'host-1',
        playerIds: ['player-1', 'player-2'],
      });
    });

    it('logs warning when no players found', async () => {
      mockInstanceRepository.listPlayersWithProfile.mockResolvedValue([]);

      const event = new InstanceStartedEvent('instance-1', 'host-1', new Date().toISOString());
      await listener['handleInstanceStarted'](event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_started_no_players' }),
      );
    });

    it('logs error when notification fails', async () => {
      mockInstanceRepository.listPlayersWithProfile.mockResolvedValue([{ userId: 'player-1' }]);
      mockNotificationService.notifyInstanceStarted.mockRejectedValue(new Error('Failed'));

      const event = new InstanceStartedEvent('instance-1', 'host-1', new Date().toISOString());
      await listener['handleInstanceStarted'](event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_started_notification_failed' }),
      );
    });
  });

  describe('handlePlayerXpEarned', () => {
    it('notifies player of XP earned', async () => {
      const event = new PlayerXpEarnedEvent(
        'instance-1',
        'player-1',
        100,
        5000,
        new Date().toISOString(),
      );
      await listener['handlePlayerXpEarned'](event);

      expect(mockNotificationService.notifyPlayerXpEarned).toHaveBeenCalledWith({
        userId: 'player-1',
        instanceId: 'instance-1',
        xpEarned: 100,
        newAllTimeXp: 5000,
      });
    });

    it('logs error when notification fails', async () => {
      mockNotificationService.notifyPlayerXpEarned.mockRejectedValue(new Error('Failed'));

      const event = new PlayerXpEarnedEvent(
        'instance-1',
        'player-1',
        100,
        5000,
        new Date().toISOString(),
      );
      await listener['handlePlayerXpEarned'](event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_xp_earned_notification_failed' }),
      );
    });
  });

  describe('handleInstanceClosed', () => {
    it('notifies all players when instance closes', async () => {
      mockInstanceRepository.listPlayersWithProfile.mockResolvedValue([
        { userId: 'player-1' },
        { userId: 'player-2' },
      ]);

      const event = new InstanceClosedEvent('instance-1', 'host-1', new Date().toISOString());
      await listener['handleInstanceClosed'](event);

      expect(mockNotificationService.notifyInstanceClosed).toHaveBeenCalledWith({
        instanceId: 'instance-1',
        hostUserId: 'host-1',
        playerIds: ['player-1', 'player-2'],
      });
    });

    it('logs warning when no players found', async () => {
      mockInstanceRepository.listPlayersWithProfile.mockResolvedValue([]);

      const event = new InstanceClosedEvent('instance-1', 'host-1', new Date().toISOString());
      await listener['handleInstanceClosed'](event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_closed_no_players' }),
      );
    });

    it('logs error when notification fails', async () => {
      mockInstanceRepository.listPlayersWithProfile.mockResolvedValue([{ userId: 'player-1' }]);
      mockNotificationService.notifyInstanceClosed.mockRejectedValue(new Error('Failed'));

      const event = new InstanceClosedEvent('instance-1', 'host-1', new Date().toISOString());
      await listener['handleInstanceClosed'](event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_closed_notification_failed' }),
      );
    });
  });

  describe('handlePlayerDisconnected', () => {
    it('notifies player of disconnection', async () => {
      const event = new PlayerDisconnectedEvent(
        'instance-1',
        'player-1',
        'socket-123',
        new Date().toISOString(),
      );
      await listener['handlePlayerDisconnected'](event);

      expect(mockNotificationService.notifyPlayerDisconnected).toHaveBeenCalledWith({
        userId: 'player-1',
        instanceId: 'instance-1',
        socketId: 'socket-123',
      });
    });

    it('logs error when notification fails', async () => {
      mockNotificationService.notifyPlayerDisconnected.mockRejectedValue(new Error('Failed'));

      const event = new PlayerDisconnectedEvent(
        'instance-1',
        'player-1',
        'socket-123',
        new Date().toISOString(),
      );
      await listener['handlePlayerDisconnected'](event);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'instance_player_disconnected_notification_failed' }),
      );
    });
  });
});
