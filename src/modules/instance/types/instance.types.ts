export type QuizInstanceStatus = 'open' | 'running' | 'closed' | 'finished';

export type QuizInstancePlayerStatus = 'joined' | 'ready' | 'playing' | 'disconnected' | 'finished';

export const QUIZ_INSTANCE_STATUSES: readonly QuizInstanceStatus[] = ['open', 'running', 'closed', 'finished'];

export const QUIZ_INSTANCE_PLAYER_STATUSES: readonly QuizInstancePlayerStatus[] = [
  'joined',
  'ready',
  'playing',
  'disconnected',
  'finished',
];
