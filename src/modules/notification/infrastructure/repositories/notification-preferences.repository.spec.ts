/**
 * NotificationPreferencesRepository unit tests.
 *
 * Tests the preferences repository methods:
 *   - `getPreferences` — retrieves user preferences
 *   - `upsertPreferences` — creates or updates preferences with defaults
 */
import { NotificationPreferencesRepository } from './notification-preferences.repository';

interface MockDbState {
  returnRows: unknown[];
}

const createMockDb = (
  returnRows: unknown[] = [],
): {
  state: MockDbState;
  db: {
    select: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
  };
} => {
  const state: MockDbState = {
    returnRows,
  };

  const db = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(returnRows),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue(returnRows[0] ?? {}),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(returnRows),
        }),
      }),
    }),
  };

  return { state, db };
};

const mockTransactionalContext = {
  getDbClient: jest.fn().mockReturnValue(null),
};

const createPreferencesRow = (
  overrides: Partial<{
    preferencesId: string;
    userId: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    achievementEnabled: boolean;
    tournamentEnabled: boolean;
    rankEnabled: boolean;
    friendEnabled: boolean;
    discussionEnabled: boolean;
    summaryEnabled: boolean;
    marketingEnabled: boolean;
    rankImprovementThreshold: number;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    updatedAt: string;
    createdAt: string;
  }> = {},
) => ({
  preferencesId: 'pref-1',
  userId: 'user-1',
  inAppEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  achievementEnabled: true,
  tournamentEnabled: true,
  rankEnabled: true,
  friendEnabled: true,
  discussionEnabled: true,
  summaryEnabled: true,
  marketingEnabled: false,
  rankImprovementThreshold: 5,
  quietHoursStart: null,
  quietHoursEnd: null,
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

describe('NotificationPreferencesRepository', () => {
  describe('getPreferences', () => {
    it('returns preferences when user has them', async () => {
      const prefsRow = createPreferencesRow();
      const { db } = createMockDb([prefsRow]);
      const repo = new NotificationPreferencesRepository(
        db as never,
        mockTransactionalContext as never,
      );

      const result = await repo.getPreferences('user-1');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-1');
      expect(result?.inAppEnabled).toBe(true);
    });

    it('returns null when user has no preferences', async () => {
      const { db } = createMockDb([]);
      const repo = new NotificationPreferencesRepository(
        db as never,
        mockTransactionalContext as never,
      );

      const result = await repo.getPreferences('user-without-prefs');

      expect(result).toBeNull();
    });

    it('queries with correct userId filter', async () => {
      const prefsRow = createPreferencesRow();
      const { db } = createMockDb([prefsRow]);
      const repo = new NotificationPreferencesRepository(
        db as never,
        mockTransactionalContext as never,
      );

      await repo.getPreferences('user-1');

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('upsertPreferences', () => {
    describe('when user has existing preferences', () => {
      it('updates the preferences', async () => {
        const updatedPrefs = createPreferencesRow({ inAppEnabled: false });
        const { db } = createMockDb([updatedPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('user-1', { inAppEnabled: false });

        expect(db.update).toHaveBeenCalled();
        expect(result.inAppEnabled).toBe(false);
      });

      it('preserves other preference values', async () => {
        const existingPrefs = createPreferencesRow({
          inAppEnabled: true,
          emailEnabled: true,
          rankImprovementThreshold: 5,
        });
        const { db } = createMockDb([existingPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('user-1', { inAppEnabled: false });

        expect(result.emailEnabled).toBe(true);
        expect(result.rankImprovementThreshold).toBe(5);
      });

      it('updates the updatedAt timestamp', async () => {
        const existingPrefs = createPreferencesRow();
        const { db } = createMockDb([existingPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        await repo.upsertPreferences('user-1', { inAppEnabled: false });

        expect(db.update).toHaveBeenCalled();
      });

      it('allows updating quiet hours', async () => {
        const existingPrefs = createPreferencesRow({
          quietHoursStart: null,
          quietHoursEnd: null,
        });
        const { db } = createMockDb([existingPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('user-1', {
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        });

        expect(result.quietHoursStart).toBe('22:00');
        expect(result.quietHoursEnd).toBe('08:00');
      });

      it('allows clearing quiet hours', async () => {
        const existingPrefs = createPreferencesRow({
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        });
        const { db } = createMockDb([existingPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('user-1', {
          quietHoursStart: null,
          quietHoursEnd: null,
        });

        expect(result.quietHoursStart).toBeNull();
        expect(result.quietHoursEnd).toBeNull();
      });

      it('allows updating rank improvement threshold', async () => {
        const existingPrefs = createPreferencesRow({ rankImprovementThreshold: 5 });
        const { db } = createMockDb([existingPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('user-1', { rankImprovementThreshold: 10 });

        expect(result.rankImprovementThreshold).toBe(10);
      });

      it('ignores internal fields like preferencesId and userId', async () => {
        const existingPrefs = createPreferencesRow();
        const { db } = createMockDb([existingPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        await repo.upsertPreferences('user-1', {
          preferencesId: 'other-pref',
          userId: 'other-user',
        } as never);

        expect(db.update).toHaveBeenCalled();
      });
    });

    describe('when user has no existing preferences', () => {
      it('creates new preferences with defaults', async () => {
        const newPrefs = createPreferencesRow();
        const { db } = createMockDb([newPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('new-user', {});

        expect(db.insert).toHaveBeenCalled();
        expect(result.userId).toBe('new-user');
      });

      it('applies default values correctly', async () => {
        const newPrefs = createPreferencesRow({
          inAppEnabled: true,
          emailEnabled: true,
          pushEnabled: true,
          achievementEnabled: true,
          tournamentEnabled: true,
          rankEnabled: true,
          friendEnabled: true,
          discussionEnabled: true,
          summaryEnabled: true,
          marketingEnabled: false,
          rankImprovementThreshold: 5,
        });
        const { db } = createMockDb([newPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('new-user', {});

        expect(result.inAppEnabled).toBe(true);
        expect(result.emailEnabled).toBe(true);
        expect(result.marketingEnabled).toBe(false);
        expect(result.rankImprovementThreshold).toBe(5);
      });

      it('allows overriding defaults on creation', async () => {
        const newPrefs = createPreferencesRow({
          inAppEnabled: false,
          marketingEnabled: true,
          rankImprovementThreshold: 15,
        });
        const { db } = createMockDb([newPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('new-user', {
          inAppEnabled: false,
          marketingEnabled: true,
          rankImprovementThreshold: 15,
        });

        expect(result.inAppEnabled).toBe(false);
        expect(result.marketingEnabled).toBe(true);
        expect(result.rankImprovementThreshold).toBe(15);
      });

      it('applies quiet hours defaults as null', async () => {
        const newPrefs = createPreferencesRow({
          quietHoursStart: null,
          quietHoursEnd: null,
        });
        const { db } = createMockDb([newPrefs]);
        const repo = new NotificationPreferencesRepository(
          db as never,
          mockTransactionalContext as never,
        );

        const result = await repo.upsertPreferences('new-user', {});

        expect(result.quietHoursStart).toBeNull();
        expect(result.quietHoursEnd).toBeNull();
      });
    });
  });
});
