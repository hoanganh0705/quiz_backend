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
