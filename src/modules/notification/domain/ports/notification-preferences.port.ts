import type { NotificationPreferencesRow } from '../types';

export const NOTIFICATION_PREFERENCES_REPOSITORY_PORT = Symbol(
  'NOTIFICATION_PREFERENCES_REPOSITORY_PORT',
);

export interface NotificationPreferencesRepositoryPort {
  getPreferences(userId: string): Promise<NotificationPreferencesRow | null>;

  getManyPreferences(userIds: string[]): Promise<Map<string, NotificationPreferencesRow>>;

  upsertPreferences(
    userId: string,
    prefs: Partial<NotificationPreferencesRow>,
  ): Promise<NotificationPreferencesRow>;
}
