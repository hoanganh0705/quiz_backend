import { Injectable } from '@nestjs/common';
import type { TournamentRepositoryPort } from '@/modules/tournament/domain/ports';
import type {
  TournamentRow,
  TournamentDetailRow,
  TournamentRoundRow,
  TournamentRoundDetailRow,
  TournamentParticipantRow,
  TournamentLeaderboardEntry,
  TournamentListFilters,
  TournamentCursorPayload,
  FinalizedTournamentParticipantRow,
  TournamentParticipantListItemRow,
  TournamentStandingRow,
  UpcomingTournamentRow,
  ActiveTournamentRow,
  CompletedTournamentRow,
  RelatedTournamentRow,
  TournamentStatsRow,
  TournamentRoundParticipantRow,
  TournamentWinnerRow,
} from '@/modules/tournament/domain/ports';
import type {
  TournamentDifficulty,
  TournamentRoundStatus,
  TournamentStatus,
} from '@/modules/tournament/types/tournament.types';
import { TournamentCrudRepository } from './aggregates/tournament-crud.repository';
import { TournamentParticipantRepository } from './aggregates/tournament-participant.repository';
import { TournamentRoundRepository } from './aggregates/tournament-round.repository';
import { TournamentRoundParticipantRepository } from './aggregates/tournament-round-participant.repository';
import { TournamentStatsRepository } from './aggregates/tournament-stats.repository';

/**
 * Thin façade over the tournament sub-repositories.
 * Every method delegates to the appropriate collaborator — no domain logic lives here.
 */
@Injectable()
export class TournamentRepository implements TournamentRepositoryPort {
  constructor(
    private readonly crud: TournamentCrudRepository,
    private readonly participant: TournamentParticipantRepository,
    private readonly round: TournamentRoundRepository,
    private readonly roundParticipant: TournamentRoundParticipantRepository,
    private readonly stats: TournamentStatsRepository,
  ) {}

  async getTournamentById(tournamentId: string): Promise<TournamentRow | null> {
    return this.crud.getTournamentById(tournamentId);
  }

  async getTournamentDetailById(tournamentId: string): Promise<TournamentDetailRow | null> {
    return this.crud.getTournamentDetailById(tournamentId);
  }

  async listTournaments(params: {
    limit: number;
    cursor?: TournamentCursorPayload | null;
    filters?: TournamentListFilters;
  }): Promise<TournamentRow[]> {
    return this.crud.listTournaments(params);
  }

  async createTournament(params: {
    title: string;
    description: string | null;
    difficulty: TournamentDifficulty;
    prize: string | null;
    startAt: string;
    endAt: string;
    maxParticipants: number | null;
    categoryId: string | null;
    ownerUserId: string;
    nowIso: string;
  }): Promise<{ tournamentId: string }> {
    return this.crud.createTournament(params);
  }

  async updateTournament(params: {
    tournamentId: string;
    title?: string;
    description?: string | null;
    difficulty?: TournamentDifficulty;
    prize?: string | null;
    startAt?: string;
    endAt?: string;
    maxParticipants?: number | null;
    categoryId?: string | null;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    return this.crud.updateTournament(params);
  }

  async softDeleteTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    return this.crud.softDeleteTournament(params);
  }

  async cancelTournament(params: {
    tournamentId: string;
    nowIso: string;
  }): Promise<TournamentRow | null> {
    return this.crud.cancelTournament(params);
  }

  async getParticipant(participantId: string): Promise<TournamentParticipantRow | null> {
    return this.participant.getParticipant(participantId);
  }

  async getParticipantByUserAndTournament(
    userId: string,
    tournamentId: string,
  ): Promise<TournamentParticipantRow | null> {
    return this.participant.getParticipantByUserAndTournament(userId, tournamentId);
  }

  async registerParticipant(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
  }): Promise<TournamentParticipantRow> {
    return this.participant.registerParticipant(params);
  }

  async withdrawParticipant(
    participantId: string,
    nowIso: string,
    tx?: unknown,
  ): Promise<TournamentParticipantRow> {
    return this.participant.withdrawParticipant(participantId, nowIso, tx);
  }

  async reactivateParticipant(
    participantId: string,
    nowIso: string,
  ): Promise<TournamentParticipantRow> {
    return this.participant.reactivateParticipant(participantId, nowIso);
  }

  async atomicRegister(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<{ participant: TournamentParticipantRow; inserted: boolean; reactivated: boolean }> {
    return this.participant.atomicRegister(params);
  }

  async atomicWithdraw(params: {
    tournamentId: string;
    userId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<TournamentParticipantRow | null> {
    return this.participant.atomicWithdraw(params);
  }

  async getRoundById(roundId: string): Promise<TournamentRoundRow | null> {
    return this.round.getRoundById(roundId);
  }

  async createRound(params: {
    tournamentId: string;
    name: string;
    description: string | null;
    quizVersionId: string;
    startAt: string | null;
    endAt: string | null;
    durationMs: number | null;
    isElimination: boolean;
    participantLimit: number | null;
    nowIso: string;
  }): Promise<TournamentRoundRow> {
    return this.round.createRound(params);
  }

  async getRoundDetailById(roundId: string): Promise<TournamentRoundDetailRow | null> {
    return this.round.getRoundDetailById(roundId);
  }

  async getRoundsByTournament(tournamentId: string): Promise<TournamentRoundRow[]> {
    return this.round.getRoundsByTournament(tournamentId);
  }

  async getRoundParticipant(
    roundId: string,
    participantId: string,
  ): Promise<TournamentRoundParticipantRow | null> {
    return this.roundParticipant.getRoundParticipant(roundId, participantId);
  }

  async createRoundParticipant(params: {
    roundId: string;
    participantId: string;
    nowIso: string;
  }): Promise<TournamentRoundParticipantRow> {
    return this.roundParticipant.createRoundParticipant(params);
  }

  async startRoundAttemptTx(params: {
    roundId: string;
    participantId: string;
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    nowIso: string;
  }): Promise<{
    attemptId: string;
    roundParticipant: TournamentRoundParticipantRow;
    inserted: boolean;
  }> {
    return this.roundParticipant.startRoundAttemptTx(params);
  }

  async createAttemptForRound(params: {
    userId: string;
    quizVersionId: string;
    tournamentId: string;
    roundId: string;
    roundParticipantId: string;
    nowIso: string;
  }): Promise<{ attemptId: string }> {
    return this.roundParticipant.createAttemptForRound(params);
  }

  async getLeaderboard(params: {
    tournamentId: string;
    limit: number;
    offset: number;
  }): Promise<{ items: TournamentLeaderboardEntry[]; total: number }> {
    return this.participant.getLeaderboard(params);
  }

  async getWinners(params: {
    tournamentId: string;
    limit: number;
  }): Promise<TournamentWinnerRow[]> {
    return this.participant.getWinners(params);
  }

  async listParticipants(params: {
    tournamentId: string;
    page: number;
    limit: number;
  }): Promise<{ items: TournamentParticipantListItemRow[]; total: number }> {
    return this.participant.listParticipants(params);
  }

  async getParticipantStanding(params: {
    tournamentId: string;
    userId: string;
    participantId?: string;
  }): Promise<TournamentStandingRow | null> {
    return this.participant.getParticipantStanding(params);
  }

  async countParticipants(tournamentId: string): Promise<number> {
    return this.participant.countParticipants(tournamentId);
  }

  async listUpcomingTournaments(params: {
    page: number;
    limit: number;
    sortBy: 'startAt' | 'registrationDeadline';
    nowIso: string;
  }): Promise<{ items: UpcomingTournamentRow[]; total: number }> {
    return this.crud.listUpcomingTournaments(params);
  }

  async listActiveTournaments(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: ActiveTournamentRow[]; total: number }> {
    return this.crud.listActiveTournaments(params);
  }

  async listCompletedTournaments(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: CompletedTournamentRow[]; total: number }> {
    return this.crud.listCompletedTournaments(params);
  }

  async listRelatedTournaments(params: {
    tournamentId: string;
    limit: number;
  }): Promise<RelatedTournamentRow[]> {
    return this.crud.listRelatedTournaments(params);
  }

  async getTournamentStats(tournamentId: string): Promise<TournamentStatsRow> {
    return this.stats.getTournamentStats(tournamentId);
  }

  async listTournamentsStartingSoon(params: {
    windowStartIso: string;
    windowEndIso: string;
  }): Promise<TournamentRow[]> {
    return this.crud.listTournamentsStartingSoon(params);
  }

  async listTournamentsStartingPlay(params: { nowIso: string }): Promise<TournamentRow[]> {
    return this.crud.listTournamentsStartingPlay(params);
  }

  async markTournamentStatus(params: {
    tournamentId: string;
    fromStatus: TournamentStatus;
    toStatus: TournamentStatus;
    nowIso: string;
    tx?: unknown;
  }): Promise<TournamentRow | null> {
    return this.crud.markTournamentStatus(params);
  }

  async listDueRoundOpens(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: TournamentRoundRow[]; total: number }> {
    return this.round.listDueRoundOpens(params);
  }

  async listDueRoundCloses(params: {
    page: number;
    limit: number;
    nowIso: string;
  }): Promise<{ items: TournamentRoundRow[]; total: number }> {
    return this.round.listDueRoundCloses(params);
  }

  async markRoundStatus(params: {
    roundId: string;
    fromStatus: TournamentRoundStatus;
    toStatus: TournamentRoundStatus;
    nowIso: string;
    tx?: unknown;
  }): Promise<TournamentRoundRow | null> {
    return this.round.markRoundStatus(params);
  }

  async finalizeTournament(params: {
    tournamentId: string;
    nowIso: string;
    tx?: unknown;
  }): Promise<FinalizedTournamentParticipantRow[]> {
    return this.stats.finalizeTournament(params);
  }

  async recalculateParticipantTotals(participantId: string, tx?: unknown): Promise<void> {
    return this.participant.recalculateParticipantTotals(participantId, tx);
  }

  async reconcileAllParticipantTotals(): Promise<{ updated: number }> {
    return this.participant.reconcileAllParticipantTotals();
  }
}
