import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Validation error carrying a per-field error map so the wire response
 * can include `extensions.validationErrors: Array<{ field, message }>`.
 *
 * Phase 5 (S-27): the question editor uses the per-field extension to
 * drive `react-hook-form`'s `setError(field, ...)` inline error UI
 * instead of rendering a single opaque toast.
 *
 * Domain-layer rule: keep the business identifier (`code`) stable and
 * put the field-by-field detail in `fieldErrors`. The global filter
 * promotes `fieldErrors` into `extensions.validationErrors`.
 */
export class QuizValidationFieldError extends BaseDomainException {
  readonly code = 'QUIZ_VALIDATION_FAILED';

  constructor(
    message: string,
    readonly fieldErrors: Array<{ field: string; message: string }>,
  ) {
    super(message);
  }
}
