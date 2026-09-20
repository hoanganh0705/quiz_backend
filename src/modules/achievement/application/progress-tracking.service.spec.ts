/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { ProgressTrackingService } from './progress-tracking.service';
import type { AchievementRepositoryPort } from '../infrastructure/repositories/achievement.repository';

function createFakeLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as const;
}

function buildRepoMock(): jest.Mocked<AchievementRepositoryPort> {
  return {
    getBadgeById: jest.fn(),
    getBadgeRules: jest.fn(),
    hasBadge: jest.fn(),
    getBadgeProgress: jest.fn(),
    getAllActiveBadges: jest.fn(),
    hasBadges: jest.fn(),
    getBadgeProgressBatch: jest.fn(),
    updateBadgeProgress: jest.fn(),
  } as unknown as jest.Mocked<AchievementRepositoryPort>;
}

const sampleBadge = {
  badgeId: 'badge-1',
  slug: 'rank1',
  type: 'gold',
  category: 'ranking',
  name: 'Rank 1',
  description: null,
  iconUrl: null,
  isActive: true,
  isHidden: false,
  version: '1.0.0',
  validFrom: null,
  validUntil: null,
  evaluationMode: 'realtime',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ProgressTrackingService', () => {
  let repo: jest.Mocked<AchievementRepositoryPort>;
  let service: ProgressTrackingService;

  beforeEach(() => {
    repo = buildRepoMock();
    service = new ProgressTrackingService(repo as never, createFakeLogger() as never);
  });

  describe('getBadgeProgressSnapshot', () => {
    it('returns null when badge not found', async () => {
      repo.getBadgeById.mockResolvedValue(null);
      const result = await service.getBadgeProgressSnapshot('user-1', 'missing');
      expect(result).toBeNull();
    });

    it('returns 100% when user has badge', async () => {
      repo.getBadgeById.mockResolvedValue(sampleBadge as any);
      repo.getBadgeRules.mockResolvedValue([]);
      repo.hasBadge.mockResolvedValue(true);

      const result = await service.getBadgeProgressSnapshot('user-1', 'badge-1');
      expect(result).not.toBeNull();
      expect(result?.percent).toBe(100);
    });

    it('returns stored progress clamped to target', async () => {
      repo.getBadgeById.mockResolvedValue(sampleBadge as any);
      repo.getBadgeRules.mockResolvedValue([
        {
          ruleId: 'r-1',
          badgeId: 'badge-1',
          ruleType: 'count',
          priority: 1,
          config: { metric: 'quizzes_completed', threshold: 5 },
          isActive: true,
          createdAt: new Date(),
        },
      ]);
      repo.hasBadge.mockResolvedValue(false);

      repo.getBadgeProgress.mockResolvedValue({ current: 3, target: 5 } as any);

      const result = await service.getBadgeProgressSnapshot('user-1', 'badge-1');
      expect(result?.current).toBe(3);
      expect(result?.target).toBe(5);
      expect(result?.percent).toBe(60);
    });
  });

  describe('getMilestones', () => {
    it('returns the milestones array', async () => {
      const milestones = await service.getMilestones();
      expect(Array.isArray(milestones)).toBe(true);
      expect(milestones.length).toBeGreaterThan(0);
    });
  });

  describe('clampValue', () => {
    it('clamps numbers to min/max', () => {
      expect(
        (
          service as never as { clampValue: (n: number, min: number, max: number) => number }
        ).clampValue(120, 0, 100),
      ).toBe(100);
      expect(
        (
          service as never as { clampValue: (n: number, min: number, max: number) => number }
        ).clampValue(-5, 0, 100),
      ).toBe(0);
      expect(
        (
          service as never as { clampValue: (n: number, min: number, max: number) => number }
        ).clampValue(50, 0, 100),
      ).toBe(50);
    });
  });

  describe('calculateStreakProgress', () => {
    it('returns progress toward next streak threshold', async () => {
      const result = await service.calculateStreakProgress('user-1', 'badge-1', 5);
      expect(result.current).toBe(5);
      expect(result.target).toBe(7);
      expect(result.isComplete).toBe(false);
    });

    it('returns 100% when streak exceeds all thresholds', async () => {
      const result = await service.calculateStreakProgress('user-1', 'badge-1', 365);
      expect(result.percentage).toBe(100);
    });
  });

  describe('calculateRankProgress', () => {
    it('returns 100% for rank 1', async () => {
      const result = await service.calculateRankProgress('user-1', 'badge-1', 1);
      expect(result.percentage).toBe(100);
      expect(result.isComplete).toBe(true);
    });

    it('returns low percentage for far rank', async () => {
      const result = await service.calculateRankProgress('user-1', 'badge-1', 50000);
      expect(result.isComplete).toBe(false);
    });
  });
});
