export type GetMyTournamentsQuery = {
  userId: string;
  limit: number;
  cursor?: { registeredAt: string; participantId: string } | null;
};
