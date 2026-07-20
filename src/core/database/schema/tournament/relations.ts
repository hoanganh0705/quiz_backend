import { relations } from 'drizzle-orm/relations';
import {
  tournaments,
  tournamentRounds,
  tournamentParticipants,
  tournamentRoundParticipants,
  tournamentStats,
} from './schema';
import { quizVersions, quizAttempts } from '../quiz/schema';
import { categories } from '../taxonomy/schema';
import { users } from '../auth/schema';

// =============================================================================
// Tournament Domain Relations
//
// Relations for: tournaments, tournamentRounds, tournamentParticipants,
//                tournamentRoundParticipants, tournamentStats
//
// FKs to other domains:
// - tournaments.categoryId → categories (taxonomy)
// - tournamentRounds.quizVersionId → quizVersions (quiz)
// - tournamentParticipants.userId → users (auth)
// - tournamentRoundParticipants.attemptId → quizAttempts (quiz)
// =============================================================================

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  tournamentRounds: many(tournamentRounds),
  category: one(categories, {
    fields: [tournaments.categoryId],
    references: [categories.categoryId],
  }),
  owner: one(users, {
    fields: [tournaments.ownerUserId],
    references: [users.userId],
  }),
  tournamentParticipants: many(tournamentParticipants),
  stats: one(tournamentStats),
}));

export const tournamentRoundsRelations = relations(tournamentRounds, ({ one, many }) => ({
  quizVersion: one(quizVersions, {
    fields: [tournamentRounds.quizVersionId],
    references: [quizVersions.quizVersionId],
  }),
  tournament: one(tournaments, {
    fields: [tournamentRounds.tournamentId],
    references: [tournaments.tournamentId],
  }),
  tournamentRoundParticipants: many(tournamentRoundParticipants),
}));

export const tournamentParticipantsRelations = relations(
  tournamentParticipants,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [tournamentParticipants.tournamentId],
      references: [tournaments.tournamentId],
    }),
    user: one(users, {
      fields: [tournamentParticipants.userId],
      references: [users.userId],
    }),
    tournamentRoundParticipants: many(tournamentRoundParticipants),
  }),
);

export const tournamentRoundParticipantsRelations = relations(
  tournamentRoundParticipants,
  ({ one }) => ({
    quizAttempt: one(quizAttempts, {
      fields: [tournamentRoundParticipants.attemptId],
      references: [quizAttempts.attemptId],
    }),
    tournamentParticipant: one(tournamentParticipants, {
      fields: [tournamentRoundParticipants.participantId],
      references: [tournamentParticipants.participantId],
    }),
    tournamentRound: one(tournamentRounds, {
      fields: [tournamentRoundParticipants.roundId],
      references: [tournamentRounds.roundId],
    }),
  }),
);

export const tournamentStatsRelations = relations(tournamentStats, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentStats.tournamentId],
    references: [tournaments.tournamentId],
  }),
}));
