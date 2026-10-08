import { AttemptCommandService } from './attempt-command.service';
import { OutboxPayloadValidationError } from '@/common/outbox/payload-schema';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import type { AttemptRepositoryPort } from './ports/attempt-repository.port';
import type { AttemptAnswerRepositoryPort } from './ports/attempt-answer-repository.port';
import type { AttemptDomainEventBusPort } from './events/attempt-domain-event-bus.port';

const user: JwtPayload = { sub: 'u-1', role: 'user', jti: 'j-1' } as JwtPayload;

const baseAttemptDetail = {
  attemptId: 'att-1',
  userId: 'u-1',
  quizId: 'q-1',
  quizVersionId: 'qv-1',
  contextType: 'solo' as const,
  contextRefId: null,
  status: 'started' as const,
  startedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: null,
  passingScorePercent: 70,
  rewardXp: 50,
};

const baseScoringData = {
  correctCount: 4,
  totalAnswers: 5,
};

function makeAttemptRepository(completeImpl: () => Promise<unknown>): AttemptRepositoryPort {
  return {
    getActiveAttemptByUserAndVersion: jest.fn(),
    getAttemptById: jest.fn(),
    getAttemptDetailById: jest
      .fn()
      .mockResolvedValue({ ...baseAttemptDetail, status: 'started' as const }),
    getAttemptAnswerScoringData: jest.fn().mockResolvedValue(baseScoringData),
    checkQuestionBelongsToVersion: jest.fn(),
    checkAnswerOptionBelongsToQuestion: jest.fn(),
    submitAnswer: jest.fn(),
    abandonAttempt: jest.fn(),
    deleteAnswer: jest.fn(),
    getAnswerByAttemptAndQuestion: jest.fn(),
    countCompletedAttempts: jest.fn(),
    completeAttemptAndSideEffects: jest.fn().mockImplementation(completeImpl),
  } as unknown as AttemptRepositoryPort;
}

function makeAnswerRepository(): AttemptAnswerRepositoryPort {
  return {
    countQuestionsByVersionId: jest.fn(),
    getAttemptAnswerScoringData: jest.fn().mockResolvedValue(baseScoringData),
    submitAnswer: jest.fn(),
    checkQuestionBelongsToVersion: jest.fn(),
    checkAnswerOptionBelongsToQuestion: jest.fn(),
    deleteAnswer: jest.fn(),
    getAnswerByAttemptAndQuestion: jest.fn(),
  } as unknown as AttemptAnswerRepositoryPort;
}

function makeService(completeImpl: () => Promise<unknown>): AttemptCommandService {
  const attemptRepository = makeAttemptRepository(completeImpl);
  const answerRepository = makeAnswerRepository();
  const attemptQueryService = {} as never;
  const eventBus = {} as AttemptDomainEventBusPort;
  const quizRepository = {
    getQuizWithPublishedVersionById: jest.fn().mockResolvedValue({
      publishedVersionId: 'qv-1',
      title: 'Quiz',
      slug: 'quiz',
    }),
  } as never;
  const referentialValidator = {} as never;
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as never;
  return new AttemptCommandService(
    attemptRepository,
    answerRepository,
    attemptQueryService,
    eventBus,
    quizRepository,
    referentialValidator,
    logger,
  );
}

describe('AttemptCommandService.completeAttempt — XP outbox payload validation', () => {
  it('propagates OutboxPayloadValidationError when the repository rejects the payload', async () => {
    const service = makeService(() =>
      Promise.reject(
        new OutboxPayloadValidationError('amount', 'expected finite number, got string'),
      ),
    );

    await expect(service.completeAttempt('att-1', user)).rejects.toThrow(
      OutboxPayloadValidationError,
    );
  });
});
