export class AttemptAnswerResponseDto {
  attemptAnswerId!: string;
  questionId!: string;
  selectedOptionId!: string | null;
  answeredAt!: string;
  timeTakenMs!: number | null;
  isCorrect!: boolean | null;
}

export class AttemptResponseDto {
  attemptId!: string;
  userId!: string;
  quizId!: string;
  quizTitle!: string;
  quizSlug!: string;
  versionNumber!: number;
  difficulty!: string;
  durationMs!: number;
  passingScorePercent!: number;
  rewardXp!: number;
  contextType!: string;
  contextRefId!: string | null;
  status!: string;
  scorePercent!: string | null;
  correctCount!: number | null;
  startedAt!: string;
  finishedAt!: string | null;
  timeTakenMs!: number | null;
  xpEarned!: number;
  answers!: AttemptAnswerResponseDto[];
}

export class AttemptSummaryResponseDto {
  attemptId!: string;
  quizId!: string;
  quizTitle!: string;
  quizSlug!: string;
  versionNumber!: number;
  difficulty!: string;
  contextType!: string;
  status!: string;
  scorePercent!: string | null;
  correctCount!: number | null;
  startedAt!: string;
  finishedAt!: string | null;
  xpEarned!: number;
}

export class AttemptListResponseDto {
  items!: AttemptSummaryResponseDto[];
  pagination!: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
}

export class SubmitAnswerResponseDto {
  attemptAnswerId!: string;
  questionId!: string;
  selectedOptionId!: string | null;
  answeredAt!: string;
  timeTakenMs!: number | null;
  isCorrect!: boolean | null;
}

export class AbandonAttemptResponseDto {
  attemptId!: string;
  status!: string;
  finishedAt!: string;
  message!: string;
}
