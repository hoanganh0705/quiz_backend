export const INSTANCE_STATUSES = ['open', 'countdown', 'running', 'closed', 'finished'] as const;
export const INSTANCE_PLAYER_STATUSES = [
  'joined',
  'ready',
  'playing',
  'disconnected',
  'finished',
] as const;

export type QuizInstanceStatus = (typeof INSTANCE_STATUSES)[number];
export type QuizInstancePlayerStatus = (typeof INSTANCE_PLAYER_STATUSES)[number];
