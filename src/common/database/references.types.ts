/**
 * Discriminated union for the polymorphic FK columns used across the
 * schema (`coin_transactions.reference_type` + `reference_id` and
 * `quiz_attempts.context_type` + `context_ref_id`).
 *
 * Each referent is a concrete aggregate that the application code
 * can validate via a repository before persisting a row that points
 * to it. This file is the single source of truth for the closed
 * set of entity kinds that may appear in a polymorphic column; new
 * referents MUST be added here (and to the matching repository +
 * ReferentialValidator) so that the union remains exhaustive.
 *
 * `null` referenceId values are intentionally NOT modeled: a row
 * with a missing referent must omit the entire reference, not
 * store `{ kind: 'attempt', id: null }`. Application code should
 * treat "no referent" as a structural absence, not as a typed
 * reference of `kind: null | id: null`.
 */
export type ReferencedEntity =
  | { kind: 'attempt'; id: string }
  | { kind: 'daily_challenge'; id: string }
  | { kind: 'streak'; id: string }
  | { kind: 'badge'; id: string }
  | { kind: 'tournament'; id: string }
  | { kind: 'tip'; id: string }
  | { kind: 'flair'; id: string }
  | { kind: 'suppress'; id: string }
  | { kind: 'admin'; id: string };

/**
 * The subset of `ReferencedEntity` whose `kind` doubles as a
 * `coin_transactions.reference_type` value. The mapping lives in
 * `mapReferenceKindToCoinType` below and is intentionally hand-
 * written to keep callers from accidentally introducing a referent
 * that the coin domain doesn't know how to render.
 */
export type CoinReferencedEntity = Extract<
  ReferencedEntity,
  {
    kind:
      | 'attempt'
      | 'daily_challenge'
      | 'streak'
      | 'badge'
      | 'tournament'
      | 'tip'
      | 'flair'
      | 'suppress'
      | 'admin';
  }
>;

/**
 * The subset of `ReferencedEntity` that can serve as
 * `quiz_attempts.context_ref_id`. Currently the schema enum
 * allows `solo` and `tournament`; only `tournament` carries a
 * referent.
 */
export type QuizAttemptContextReference = Extract<ReferencedEntity, { kind: 'tournament' }>;

/**
 * Application-level error thrown when a referent does not exist in
 * the database at validation time. Distinct from FK-violation
 * errors (which surface later as 23503) so the user sees a clean
 * domain error instead of a raw database constraint failure.
 */
export class ReferencedEntityNotFoundError extends Error {
  public readonly entity: ReferencedEntity;

  constructor(entity: ReferencedEntity) {
    super(`Referenced entity not found: kind=${entity.kind} id=${entity.id}`);
    this.name = 'ReferencedEntityNotFoundError';
    this.entity = entity;
  }
}

/**
 * Application-level error thrown when the kind/id pair is
 * syntactically malformed (e.g. empty id). Validation runs before
 * the existence check so that "obviously bad" inputs fail fast
 * with a domain error rather than triggering a DB query.
 */
export class ReferencedEntityInvalidError extends Error {
  public readonly entity:
    | ReferencedEntity
    | { kind: ReferencedEntity['kind']; id: '' | null | undefined };

  constructor(
    entity: ReferencedEntity | { kind: ReferencedEntity['kind']; id: '' | null | undefined },
    reason: string,
  ) {
    super(`Referenced entity invalid: ${reason} (kind=${entity.kind} id=${String(entity.id)})`);
    this.name = 'ReferencedEntityInvalidError';
    this.entity = entity;
  }
}

export function isReferencedEntity(value: unknown): value is ReferencedEntity {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj['id'] !== 'string' || obj['id'].length === 0) return false;
  switch (obj['kind']) {
    case 'attempt':
    case 'daily_challenge':
    case 'streak':
    case 'badge':
    case 'tournament':
    case 'tip':
    case 'flair':
    case 'suppress':
    case 'admin':
      return true;
    default:
      return false;
  }
}

export function asReferencedEntity(value: unknown): ReferencedEntity {
  if (typeof value !== 'object' || value === null) {
    throw new ReferencedEntityInvalidError({ kind: 'attempt', id: '' }, 'value is not an object');
  }
  const obj = value as Record<string, unknown>;
  const kind = obj['kind'];
  const id = obj['id'];
  if (typeof id !== 'string' || id.length === 0) {
    throw new ReferencedEntityInvalidError(
      { kind: 'attempt', id: '' },
      'id must be a non-empty string',
    );
  }
  switch (kind) {
    case 'attempt':
    case 'daily_challenge':
    case 'streak':
    case 'badge':
    case 'tournament':
    case 'tip':
    case 'flair':
    case 'suppress':
    case 'admin':
      return { kind, id };
    default:
      throw new ReferencedEntityInvalidError(
        { kind: 'attempt', id: '' },
        `unknown kind ${String(kind)}`,
      );
  }
}

/**
 * Map a `ReferencedEntity` to the column-shaped pair used by
 * `coin_transactions`. The mapping is exhaustive over the coin
 * subset so a new `ReferencedEntity` kind requires a deliberate
 * decision about whether it can appear in a coin ledger row.
 */
export function mapReferenceKindToCoinType(entity: CoinReferencedEntity): {
  referenceType: string;
  referenceId: string;
} {
  return { referenceType: entity.kind, referenceId: entity.id };
}
