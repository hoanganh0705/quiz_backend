import { Test, TestingModule } from '@nestjs/testing';
import { UserApplicationService } from './user.application.service';
import { UserDomainService } from '../domain/user.service';
import { UserResponseMapper } from '../mappers/user-response.mapper';

describe('UserApplicationService', () => {
  let service: UserApplicationService;
  let mockUserDomainService: jest.Mocked<UserDomainService>;

  const mockUserMeRow = {
    userId: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    xpTotal: 1500,
    currentStreak: 5,
    longestStreak: 10,
    settings: {},
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    displayName: 'Test User',
    avatarUrl: null,
    bio: null,
  };

  beforeEach(async () => {
    mockUserDomainService = {
      getMe: jest.fn(),
      updateProfile: jest.fn(),
      updateSettings: jest.fn(),
      listUserBadges: jest.fn(),
      listUserActivity: jest.fn(),
      getMyTournaments: jest.fn(),
      getMyTournamentHistory: jest.fn(),
      getPublicTournamentProfile: jest.fn(),
      getMyTournamentAnalytics: jest.fn(),
      getUserRanking: jest.fn(),
      getUserAnalytics: jest.fn(),
    } as unknown as jest.Mocked<UserDomainService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserApplicationService,
        { provide: UserDomainService, useValue: mockUserDomainService },
      ],
    }).compile();

    service = module.get<UserApplicationService>(UserApplicationService);
  });

  describe('getMe', () => {
    it('should return mapped user me response', async () => {
      mockUserDomainService.getMe.mockResolvedValue(mockUserMeRow);
      const result = await service.getMe('user-1');
      expect(mockUserDomainService.getMe).toHaveBeenCalledWith('user-1');
      expect(result).toHaveProperty('userId', 'user-1');
      expect(result).toHaveProperty('username', 'testuser');
    });
  });

  describe('updateProfile', () => {
    it('should delegate profile update to domain service', async () => {
      const dto = { displayName: 'New Name', bio: null, avatarUrl: null };
      const updatedRow = { ...mockUserMeRow, displayName: 'New Name' };
      mockUserDomainService.updateProfile.mockResolvedValue(updatedRow);
      const result = await service.updateProfile('user-1', dto);
      expect(mockUserDomainService.updateProfile).toHaveBeenCalled();
      expect(result).toHaveProperty('displayName', 'New Name');
    });
  });

  describe('listUserBadges', () => {
    it('should return paginated badge response with cursor', async () => {
      const mockBadgeItems = [
        { userBadgeId: 'ub1', badgeId: 'b1', name: 'Badge 1', description: 'Desc', earnedAt: '2025-01-01' },
        { userBadgeId: 'ub2', badgeId: 'b2', name: 'Badge 2', description: 'Desc', earnedAt: '2025-01-02' },
      ];
      mockUserDomainService.listUserBadges.mockResolvedValue({
        items: mockBadgeItems,
        limit: 10,
        hasNextPage: false,
        nextCursor: null,
      });
      const result = await service.listUserBadges('user-1', 'user-1', { limit: 10, cursor: null });
      expect(result.items).toHaveLength(2);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should return all items with hasNextPage=true when more items exist than limit', async () => {
      const mockBadgeItems = Array.from({ length: 11 }, (_, i) => ({
        userBadgeId: `ub${i}`,
        badgeId: `b${i}`,
        name: `Badge ${i}`,
        description: 'Desc',
        earnedAt: '2025-01-01',
      }));
      mockUserDomainService.listUserBadges.mockResolvedValue({
        items: mockBadgeItems,
        limit: 10,
        hasNextPage: true,
        nextCursor: { earnedAt: '2025-01-01', userBadgeId: 'ub10' },
      });
      const result = await service.listUserBadges('user-1', 'user-1', { limit: 10, cursor: null });
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.items).toHaveLength(11);
    });
  });

  describe('getMyTournaments', () => {
    it('should map cursor-based pagination response correctly', async () => {
      mockUserDomainService.getMyTournaments.mockResolvedValue({
        items: [
          { participantId: 'p1', tournamentId: 't1', name: 'Tournament 1', status: 'ongoing', registeredAt: '2025-01-01', startAt: '2025-01-02', endAt: '2025-01-03' },
        ],
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });
      const result = await service.getMyTournaments('user-1', 'user-1', { limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.hasNextPage).toBe(false);
    });
  });

  describe('getMyTournamentHistory', () => {
    it('should map history items with correct field names', async () => {
      mockUserDomainService.getMyTournamentHistory.mockResolvedValue({
        items: [
          { participantId: 'p1', tournamentId: 't1', tournamentName: 'Tournament 1', finalRank: 5, finalScore: 800, participantCount: 100, completedAt: '2025-01-01' },
        ],
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });
      const result = await service.getMyTournamentHistory('user-1', 'user-1', { limit: 20 });
      expect(result.items[0].rank).toBe(5);
      expect(result.items[0].participantCount).toBe(100);
    });
  });

  describe('getUserTournamentHistory', () => {
    it('should reuse same mapping as getMyTournamentHistory', async () => {
      mockUserDomainService.getMyTournamentHistory.mockResolvedValue({
        items: [
          { participantId: 'p1', tournamentId: 't1', tournamentName: 'Tournament 1', finalRank: 3, finalScore: 900, participantCount: 50, completedAt: '2025-01-01' },
        ],
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });
      const result = await service.getUserTournamentHistory('user-1', 'user-1', { limit: 20 });
      expect(result.items[0].rank).toBe(3);
    });
  });

  describe('getPublicTournamentProfile', () => {
    it('should return full profile fields', async () => {
      mockUserDomainService.getPublicTournamentProfile.mockResolvedValue({
        userId: 'user-1',
        tournamentsPlayed: 10,
        tournamentsWon: 2,
        bestRank: 1,
        averageRank: 5,
        top10Finishes: 8,
        totalTournamentScore: 5000,
        lastTournamentAt: '2025-01-01',
      });
      const result = await service.getPublicTournamentProfile('user-1', 'user-1');
      expect(result.tournamentsWon).toBe(2);
      expect(result.bestRank).toBe(1);
    });
  });

  describe('getMyTournamentAnalytics', () => {
    it('should map analytics fields', async () => {
      mockUserDomainService.getMyTournamentAnalytics.mockResolvedValue({
        tournamentsPlayed: 10,
        wins: 2,
        top3Finishes: 4,
        top10Finishes: 8,
        averageRank: 5,
        bestRank: 1,
        averageScore: 75,
        totalTournamentScore: 5000,
        completionRate: 90,
        lastTournamentAt: '2025-01-01',
      });
      const result = await service.getMyTournamentAnalytics('user-1');
      expect(result.wins).toBe(2);
      expect(result.bestRank).toBe(1);
    });
  });

  describe('getUserRanking', () => {
    it('should delegate to domain service', async () => {
      const mockRanking = { userId: 'user-1', globalRank: 42, totalScore: 1500, level: 4, updatedAt: '2025-01-01' };
      mockUserDomainService.getUserRanking.mockResolvedValue(mockRanking);
      const result = await service.getUserRanking('user-1', 'user-1');
      expect(result.globalRank).toBe(42);
    });
  });

  describe('getUserAnalytics', () => {
    it('should return mapped analytics response', async () => {
      const mockAnalytics = {
        userId: 'user-1',
        summary: { totalAttempts: 10, completedQuizzes: 8, averageScore: 82.5 },
        favoriteCategory: { categoryId: 'cat-1', name: 'Science' },
        favoriteTag: null,
        lastUpdated: '2025-01-01',
      };
      mockUserDomainService.getUserAnalytics.mockResolvedValue(mockAnalytics);
      const result = await service.getUserAnalytics('user-1', 'user-1');
      expect(result.summary.totalAttempts).toBe(10);
    });
  });

  describe('updateSettings', () => {
    it('should delegate settings update to domain service', async () => {
      const dto = { settings: { theme: 'dark' } };
      const updatedRow = { ...mockUserMeRow, settings: { theme: 'dark' } };
      mockUserDomainService.updateSettings.mockResolvedValue(updatedRow);
      const result = await service.updateSettings('user-1', dto);
      expect(mockUserDomainService.updateSettings).toHaveBeenCalled();
      expect(result).toHaveProperty('settings');
    });
  });

  describe('listUserActivity', () => {
    it('should return paginated activity with cursor', async () => {
      mockUserDomainService.listUserActivity.mockResolvedValue({
        items: [
          { eventId: 'e1', eventType: 'attempt_completed', metadata: {}, createdAt: '2025-01-01' },
        ],
        limit: 20,
        hasNextPage: false,
        nextCursor: null,
      });
      const result = await service.listUserActivity('user-1', { limit: 20, cursor: null });
      expect(result.items).toHaveLength(1);
    });
  });
});
