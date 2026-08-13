import { BaseDomainException } from '@/common/errors/base-domain.exception';

/**
 * Coin-domain marker — kept as a module-namespacing intermediate like the
 * ranking / achievement / tournament error bases. No concrete instance
 * is ever thrown; concrete errors subclass this for symmetry and to
 * allow `instanceof` checks in unit tests.
 *
 * Concrete exceptions add a `code` field on the subclass directly (see
 * the ranking convention documented in
 * `src/modules/ranking/domain/errors/ranking-domain.errors.ts:34`).
 */
export abstract class CoinDomainError extends BaseDomainException {}
