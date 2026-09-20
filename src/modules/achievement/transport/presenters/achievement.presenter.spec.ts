import { AchievementPresenter } from './achievement.presenter';
import type { BadgeDetailsResponseDto } from '../../dto/response/badge-details-response.dto';

describe('AchievementPresenter', () => {
  const presenter = new AchievementPresenter();

  function makeBadgeDetails(
    overrides: Partial<BadgeDetailsResponseDto> = {},
  ): BadgeDetailsResponseDto {
    return {
      id: 'badge-1',
      name: 'Top 10',
      description: 'Reach Top 10',
      rarity: 'epic',
      earnedCount: 123,
      ...overrides,
    };
  }

  it('wraps badge details', () => {
    const details = makeBadgeDetails();
    const envelope = presenter.getBadgeDetails(details);
    expect(envelope.data).toEqual(details);
  });

  it('wraps paginated badge catalog', () => {
    const payload = {
      items: [
        {
          id: 'badge-1',
          name: 'Top 10',
          description: 'Reach Top 10',
          rarity: 'epic',
          earnedCount: 100,
        },
        {
          id: 'badge-2',
          name: 'Veteran',
          description: null,
          rarity: 'rare',
          earnedCount: 50,
        },
      ],
      total: 25,
      limit: 20,
      offset: 0,
    };
    const envelope = presenter.getBadgeCatalog(payload);
    expect(envelope.data).toHaveLength(2);
    expect(envelope.meta.pagination).toBeDefined();
  });

  it('wraps paginated user history', () => {
    const payload = {
      items: [
        {
          userBadgeId: 'ub-1',
          userId: 'user-1',
          badgeId: 'badge-1',
          badgeSlug: 'top10',
          badgeName: 'Top 10',
          badgeType: 'top10',
          badgeCategory: 'rank',
          earnedAt: '2025-06-01T10:00:00.000Z',
          badgeVersion: '1.0.0',
          expiresAt: null,
          revokedAt: null,
          revocationReason: null,
          metadata: {},
          isActive: true,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };
    const envelope = presenter.getUserHistory(payload);
    expect(envelope.data).toHaveLength(1);
  });
});
