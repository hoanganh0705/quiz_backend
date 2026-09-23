import {
  ReferencedEntityInvalidError,
  ReferencedEntityNotFoundError,
  asReferencedEntity,
  isReferencedEntity,
  mapReferenceKindToCoinType,
  type ReferencedEntity,
} from './references.types';

describe('references.types', () => {
  describe('isReferencedEntity', () => {
    it.each([
      { kind: 'attempt', id: 'a1' },
      { kind: 'daily_challenge', id: 'dc1' },
      { kind: 'streak', id: '7' },
      { kind: 'badge', id: 'b1' },
      { kind: 'tournament', id: 't1' },
      { kind: 'tip', id: 'u1' },
      { kind: 'flair', id: 'ub1' },
      { kind: 'suppress', id: 'q1' },
      { kind: 'admin', id: 'u2' },
    ] as ReferencedEntity[])('accepts $kind + $id', (entity) => {
      expect(isReferencedEntity(entity)).toBe(true);
    });

    it.each([
      null,
      undefined,
      'string',
      42,
      {},
      { kind: 'attempt' },
      { kind: 'attempt', id: '' },
      { id: 'a1' },
      { kind: 'unknown', id: 'x' },
      { kind: 'attempt', id: 123 },
    ])('rejects %p', (value) => {
      expect(isReferencedEntity(value)).toBe(false);
    });
  });

  describe('asReferencedEntity', () => {
    it('returns a typed entity for valid input', () => {
      const result = asReferencedEntity({ kind: 'attempt', id: 'a1' });
      expect(result).toEqual({ kind: 'attempt', id: 'a1' });
    });

    it('throws ReferencedEntityInvalidError when the value is not an object', () => {
      expect(() => asReferencedEntity('not-an-object')).toThrow(ReferencedEntityInvalidError);
    });

    it('throws ReferencedEntityInvalidError when id is empty', () => {
      expect(() => asReferencedEntity({ kind: 'attempt', id: '' })).toThrow(
        ReferencedEntityInvalidError,
      );
    });

    it('throws ReferencedEntityInvalidError when kind is unknown', () => {
      expect(() => asReferencedEntity({ kind: 'mystery', id: 'x' })).toThrow(
        ReferencedEntityInvalidError,
      );
    });
  });

  describe('mapReferenceKindToCoinType', () => {
    it('round-trips kind to referenceType', () => {
      expect(mapReferenceKindToCoinType({ kind: 'attempt', id: 'a1' })).toEqual({
        referenceType: 'attempt',
        referenceId: 'a1',
      });
      expect(mapReferenceKindToCoinType({ kind: 'streak', id: '7' })).toEqual({
        referenceType: 'streak',
        referenceId: '7',
      });
      expect(mapReferenceKindToCoinType({ kind: 'tip', id: 'u1' })).toEqual({
        referenceType: 'tip',
        referenceId: 'u1',
      });
    });
  });

  describe('ReferencedEntityNotFoundError', () => {
    it('carries the offending entity', () => {
      const entity: ReferencedEntity = { kind: 'attempt', id: 'missing' };
      try {
        throw new ReferencedEntityNotFoundError(entity);
      } catch (err) {
        expect(err).toBeInstanceOf(ReferencedEntityNotFoundError);
        expect((err as ReferencedEntityNotFoundError).entity).toEqual(entity);
        expect((err as ReferencedEntityNotFoundError).message).toContain('attempt');
        expect((err as ReferencedEntityNotFoundError).message).toContain('missing');
      }
    });
  });
});
