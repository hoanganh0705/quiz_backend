import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Notification-module namespace marker for all notification-domain
 * exceptions.
 *
 * Per the RFC 7807 migration plan (§7.1), intermediate abstract layers
 * are removed — but a module-namespace marker is a legitimate use of
 * an intermediate class. (Today no dispatch on this class happens at
 * the global-filter level; the filter resolves each concrete
 * exception's `code` via `ProblemCodeMapping` instead. The
 * intermediate stays as a domain-side marker for symmetry with the
 * other 14 modules.)
 *
 * Abstract — does not declare a `code` — because no concrete exception
 * needs a generic `code` for an unmapped operation failure. Audit:
 * `grep -rn 'new NotificationError' src/` returns no matches.
 *
 * Phase 5 (rev5.1) specific note: notification was inadvertently
 * skipped in Phases 1-3 because it had no per-module filter (no
 * `NotificationDomainExceptionFilter` to delete). Its errors extended
 * `Error` directly, so the global filter caught them via its
 * `instanceof Error` branch and returned 500 with `title:
 * 'InternalServerError'` — masking a legitimate 404 (notification
 * not found) as a generic 500 and masking a legitimate 403 (user
 * lacks permission for this specific notification) the same way. Phase
 * 5 fixes this by converting to `BaseDomainException` + class-level
 * `code` + 2 `ProblemCodeMapping` entries.
 */
export abstract class NotificationError extends BaseDomainException {}

/**
 * Thrown when a notification lookup fails (notification does not
 * exist or has been deleted). 404 Not Found.
 *
 * Wire-shape improvement: prior behavior routed this error
 * (which `extends Error`) through the global filter's `instanceof
 * Error` branch and returned 500 with `title: 'InternalServerError'`.
 * After Phase 5 the global filter resolves the new code
 * `NOTIFICATION_NOT_FOUND` and returns a proper 404 with
 * `extensions.code = 'NOTIFICATION_NOT_FOUND'`.
 */
export class NotificationNotFoundError extends NotificationError {
  readonly code = 'NOTIFICATION_NOT_FOUND';
  constructor(id: string) {
    super(`Notification not found: ${id}`);
  }
}

/**
 * Thrown when a notification belongs to a different user than the
 * authenticated caller (i.e. the caller is authenticated but lacks
 * permission for this specific notification resource). 403 Forbidden.
 *
 * Wire-shape improvement: prior behavior routed this error
 * (which `extends Error`) through the global filter's `instanceof
 * Error` branch and returned 500 with `title: 'InternalServerError'`.
 * After Phase 5 the global filter resolves the new code
 * `NOTIFICATION_FORBIDDEN` and returns a proper 403 with
 * `extensions.code = 'NOTIFICATION_FORBIDDEN'`.
 *
 * Note on the 401 vs 403 distinction: `NotificationForbiddenError`
 * is thrown AFTER `NotificationNotFoundError`, so the caller is
 * authenticated — 403 is correct (forbidden), not 401
 * (unauthenticated). The throw-sites at
 * `notification-application.service.ts:132, 160, 209` all check
 * `notification.userId !== user.sub` after a successful lookup,
 * confirming the 403 semantic.
 */
export class NotificationForbiddenError extends NotificationError {
  readonly code = 'NOTIFICATION_FORBIDDEN';
  constructor() {
    super('You do not have permission to access this notification');
  }
}
