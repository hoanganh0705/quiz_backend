import type { ProblemCodeInfo } from '../problem-code.types';
import { HttpStatus } from '@nestjs/common';

export const NotificationProblemCodeMapping = {
  NOTIFICATION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    title: 'NotFound',
    typeUri: 'https://api.quiz.local/problems/notification-not-found',
  },
  NOTIFICATION_FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    title: 'Forbidden',
    typeUri: 'https://api.quiz.local/problems/notification-forbidden',
  },
} as const satisfies Readonly<Record<string, ProblemCodeInfo>>;
