export type GetMyTournamentHistoryQuery = {
  userId: string;
  limit: number;
  cursor?: { completedAt: string; participantId: string } | null;
};
