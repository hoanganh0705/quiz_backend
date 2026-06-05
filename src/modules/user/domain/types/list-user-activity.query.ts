export type ListUserActivityQuery = {
  limit?: number;
  cursor?: { createdAt: string; eventId: string } | null;
};
