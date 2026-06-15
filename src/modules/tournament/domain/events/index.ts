import { TournamentJoinedEvent } from './tournament-joined.event';
import { TournamentParticipantWithdrawnEvent } from './tournament-participant-withdrawn.event';
import {
  TournamentStartingSoonEvent,
  TournamentCompletedEvent,
  TournamentWonEvent,
} from './tournament-joined.event';

export {
  TournamentJoinedEvent,
  TournamentParticipantWithdrawnEvent,
  TournamentStartingSoonEvent,
  TournamentCompletedEvent,
  TournamentWonEvent,
};

export type TournamentDomainEvent =
  | TournamentJoinedEvent
  | TournamentParticipantWithdrawnEvent
  | TournamentStartingSoonEvent
  | TournamentCompletedEvent
  | TournamentWonEvent;
