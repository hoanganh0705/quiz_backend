import { BaseDomainException } from '@/common/errors/base-domain.exception';

export class QuizValidationFieldError extends BaseDomainException {
  readonly code = 'QUIZ_VALIDATION_FAILED';

  constructor(
    message: string,
    readonly fieldErrors: Array<{ field: string; message: string }>,
  ) {
    super(message);
  }
}
