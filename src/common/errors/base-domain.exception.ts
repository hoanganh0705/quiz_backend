/**
 * Abstract base class for every domain-layer exception.
 *
 * Per the RFC 7807 migration plan (§6.2, §4.4), the only exception-side field
 * the domain layer carries is `code` — a stable, business-level identifier.
 * HTTP-specific information (`status`, `title`, `typeUri`) lives in the
 * transport-side `ProblemCodeMapping` consumed by `GlobalExceptionFilter`,
 * not on the class. This keeps the `domain/` package reusable across any
 * future transport (REST today, GraphQL/gRPC/CLI/jobs tomorrow).
 *
 * Concrete subclasses must declare a `readonly code = '...'` field. The
 * `abstract readonly` declaration on this class makes missing `code` a
 * TypeScript compile error, so the type system enforces the contract that
 * every concrete exception carries an identifier.
 *
 * Usage:
 *   class QuizNotFoundError extends BaseDomainException {
 *     readonly code = 'QUIZ_NOT_FOUND';
 *     constructor(quizId: string) {
 *       super(`Quiz with id '${quizId}' was not found.`);
 *     }
 *   }
 */
export abstract class BaseDomainException extends Error {
  /**
   * Stable, machine-readable identifier for this exception class.
   * Format: `<MODULE>_<ENTITY>_<SEMANTIC>` (see plan §6.1).
   * Resolved by `GlobalExceptionFilter` against `ProblemCodeMapping` to
   * produce HTTP `status`/`title`/`type` for the response.
   */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    // Preserve the concrete class name on the standard `Error.name` field so
    // existing log paths that read `errorName` keep working.
    this.name = new.target.name;
  }
}
