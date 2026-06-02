export class NotificationResponseDto {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  channel: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export class NotificationListResponseDto {
  items: NotificationResponseDto[];
  unreadCount: number;
  hasNextPage: boolean;
}

export class NotificationPreferencesResponseDto {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  achievementEnabled: boolean;
  tournamentEnabled: boolean;
  rankEnabled: boolean;
  friendEnabled: boolean;
  summaryEnabled: boolean;
  marketingEnabled: boolean;
  rankImprovementThreshold: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}
