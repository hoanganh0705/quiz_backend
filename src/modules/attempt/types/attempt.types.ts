export const ATTEMPT_STATUSES = ['started', 'completed', 'abandoned'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ATTEMPT_CONTEXT_TYPES = ['solo', 'tournament'] as const;
export type AttemptContextType = (typeof ATTEMPT_CONTEXT_TYPES)[number];

export enum AttemptStatusEnum {
  Started = 'started',
  Completed = 'completed',
  Abandoned = 'abandoned',
}

export enum AttemptContextTypeEnum {
  Solo = 'solo',
  Tournament = 'tournament',
}
