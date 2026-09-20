/* eslint-disable @typescript-eslint/unbound-method */
import { BadgeRevocationService } from './badge-revocation.service';
import type { AchievementRepositoryPort } from '../../infrastructure/repositories/achievement.repository';
import type { AchievementDomainEventBus } from '../events/achievement-domain.event-bus';

function createFakeLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as const;
}

function buildRepositoryMock(): jest.Mocked<AchievementRepositoryPort> {
  return {
    hasBadge: jest.fn(),
    hasBadges: jest.fn(),
    revokeBadge: jest.fn(),
    restoreBadge: jest.fn(),
    getRevokedUserBadges: jest.fn(),
  } as unknown as jest.Mocked<AchievementRepositoryPort>;
}

function buildEventBusMock(): jest.Mocked<AchievementDomainEventBus> {
  return {
    emitBadgeRevoked: jest.fn(),
    emitBadgeRestored: jest.fn(),
  } as unknown as jest.Mocked<AchievementDomainEventBus>;
}

describe('BadgeRevocationService', () => {
  let repo: jest.Mocked<AchievementRepositoryPort>;
  let eventBus: jest.Mocked<AchievementDomainEventBus>;
  let service: BadgeRevocationService;

  beforeEach(() => {
    repo = buildRepositoryMock();
    eventBus = buildEventBusMock();
    service = new BadgeRevocationService(
      repo as never,
      eventBus as never,
      createFakeLogger() as never,
    );
  });

  describe('validateRequest', () => {
    const baseRequest = {
      userId: 'user-1',
      badgeId: 'badge-1',
      reason: 'Manual correction by administrator',
      revokedBy: 'admin-1',
    };

    it('returns success when all fields valid', async () => {
      repo.hasBadge.mockResolvedValue(true);
      repo.revokeBadge.mockResolvedValue({
        userBadgeId: 'ub-1',
        userId: 'user-1',
        badgeId: 'badge-1',
        badgeSlug: 'top10',
        badgeName: 'Top 10',
        revokedAt: new Date(),
        revocationReason: 'Manual correction by administrator',
      });

      const result = await service.revokeBadge(baseRequest);

      expect(result.success).toBe(true);
      expect(eventBus.emitBadgeRevoked).toHaveBeenCalled();
    });

    it('fails when reason is too short', async () => {
      const result = await service.revokeBadge({
        ...baseRequest,
        reason: 'short',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('reason must be at least');
    });

    it('fails when user has no active badge', async () => {
      repo.hasBadge.mockResolvedValue(false);

      const result = await service.revokeBadge(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('fails when reason is only whitespace', async () => {
      const result = await service.revokeBadge({
        ...baseRequest,
        reason: '          ',
      });

      expect(result.success).toBe(false);
    });

    it('fails when revokedBy is empty', async () => {
      const result = await service.revokeBadge({
        ...baseRequest,
        revokedBy: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('revokedBy');
    });

    it('handles repository errors', async () => {
      repo.hasBadge.mockImplementationOnce(() => {
        return Promise.reject(new Error('boom'));
      });

      const result = await service.revokeBadge(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('boom');
    });
  });

  describe('reverseRevocation', () => {
    it('restores a revoked badge and emits event', async () => {
      repo.hasBadge.mockResolvedValue(false);
      repo.restoreBadge.mockResolvedValue({
        userBadgeId: 'ub-1',
        userId: 'user-1',
        badgeId: 'badge-1',
        badgeSlug: 'top10',
        badgeName: 'Top 10',
        revokedAt: new Date(0),
        revocationReason: '',
      });

      const result = await service.reverseRevocation('user-1', 'badge-1', 'admin-1', 'restored');

      expect(result.success).toBe(true);
      expect(eventBus.emitBadgeRestored).toHaveBeenCalled();
    });

    it('fails when badge is not revoked', async () => {
      repo.hasBadge.mockResolvedValue(true);

      const result = await service.reverseRevocation('user-1', 'badge-1', 'admin-1', 'restored');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not revoked');
    });

    it('fails when no revoked record found', async () => {
      repo.hasBadge.mockResolvedValue(false);
      repo.restoreBadge.mockResolvedValue(null);

      const result = await service.reverseRevocation('user-1', 'badge-1', 'admin-1', 'restored');

      expect(result.success).toBe(false);
    });
  });

  describe('canReawardBadge', () => {
    it('returns true when user lacks badge', async () => {
      repo.hasBadge.mockResolvedValue(false);
      await expect(service.canReawardBadge('user-1', 'badge-1')).resolves.toBe(true);
    });

    it('returns false when user already owns badge', async () => {
      repo.hasBadge.mockResolvedValue(true);
      await expect(service.canReawardBadge('user-1', 'badge-1')).resolves.toBe(false);
    });
  });

  describe('static helpers', () => {
    it('createRevocationRequest appends additional details', () => {
      const req = BadgeRevocationService.createRevocationRequest(
        'user-1',
        'badge-1',
        'DATA_ERROR' as never,
        'admin-1',
        'extra note',
      );
      expect(req.reason).toContain('extra note');
    });

    it('getReasonCode returns null for unknown message', () => {
      expect(BadgeRevocationService.getReasonCode('not a known message')).toBeNull();
    });
  });
});
