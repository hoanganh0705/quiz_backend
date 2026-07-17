/// <reference types="jest" />
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateInstanceDto,
  GetLeaderboardQueryDto,
  INSTANCE_STATUSES,
  ListInstancesQueryDto,
} from './instance.dto';
import { QUIZ_DIFFICULTIES } from '@/modules/quiz/types/quiz.types';
import { decodeInstanceCursor, decodeLeaderboardCursor } from '@/common/utils/cursor.util';

/**
 * `instance.dto.spec.ts` — guard the request-DTO contract for the
 * `instance` module. Initially added in Phase 1 of
 * `docs/audits/INSTANCE_API_CONTRACT_AUDIT.md` and extended in Phase 4
 * to also exercise:
 *   - the documented `status` / `difficulty` enums (issue 2.1)
 *   - the `limit` cursor-range bounds (issue 2.3)
 *   - the cursor round-trip helper contract (issues 2.4 / 2.5 / 2.9)
 *
 * The unit tests here run via `class-transformer` + `class-validator`
 * — the same pipeline NestJS uses at request time — so any future
 * removal of these validators surfaces here.
 */
describe('instance.dto — Phase 1/4 validation contract', () => {
  type DtoCtor = new () => object;
  const runValidate = async (ctor: DtoCtor, input: Record<string, unknown>) => {
    const instance = plainToInstance(ctor, input);
    const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
    return errors;
  };

  describe('CreateInstanceDto', () => {
    describe('quizVersionId', () => {
      it('accepts a valid UUID', async () => {
        const errors = await runValidate(CreateInstanceDto, {
          quizVersionId: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(errors).toEqual([]);
      });

      it('rejects a non-UUID string', async () => {
        const errors = await runValidate(CreateInstanceDto, {
          quizVersionId: 'not-a-uuid',
        });
        expect(errors.length).toBeGreaterThan(0);
      });

      it('rejects a missing quizVersionId', async () => {
        const errors = await runValidate(CreateInstanceDto, {});
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe('maxPlayers', () => {
      it('is optional (omitted → no errors)', async () => {
        const errors = await runValidate(CreateInstanceDto, {
          quizVersionId: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(errors).toEqual([]);
      });

      it.each([2, 50, 100])('accepts maxPlayers=%i (within bounds)', async (value) => {
        const errors = await runValidate(CreateInstanceDto, {
          quizVersionId: '550e8400-e29b-41d4-a716-446655440000',
          maxPlayers: value,
        });
        expect(errors).toEqual([]);
      });

      it('rejects maxPlayers=1 (below minimum)', async () => {
        const errors = await runValidate(CreateInstanceDto, {
          quizVersionId: '550e8400-e29b-41d4-a716-446655440000',
          maxPlayers: 1,
        });
        expect(errors.length).toBeGreaterThan(0);
      });

      it('rejects maxPlayers=101 (above maximum)', async () => {
        const errors = await runValidate(CreateInstanceDto, {
          quizVersionId: '550e8400-e29b-41d4-a716-446655440000',
          maxPlayers: 101,
        });
        expect(errors.length).toBeGreaterThan(0);
      });

      it('rejects non-integer maxPlayers', async () => {
        const errors = await runValidate(CreateInstanceDto, {
          quizVersionId: '550e8400-e29b-41d4-a716-446655440000',
          maxPlayers: 3.5,
        });
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('GetLeaderboardQueryDto', () => {
    it('accepts an empty object (uses class defaults)', async () => {
      const errors = await runValidate(GetLeaderboardQueryDto, {});
      expect(errors).toEqual([]);
    });

    it.each([1, 20, 100])('accepts limit=%i', async (value) => {
      const errors = await runValidate(GetLeaderboardQueryDto, { limit: value });
      expect(errors).toEqual([]);
    });

    it('rejects limit=0', async () => {
      const errors = await runValidate(GetLeaderboardQueryDto, { limit: 0 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects limit=101', async () => {
      const errors = await runValidate(GetLeaderboardQueryDto, { limit: 101 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('accepts a short cursor string', async () => {
      const errors = await runValidate(GetLeaderboardQueryDto, {
        cursor: 'eyJyYW5rIjoyfQ',
      });
      expect(errors).toEqual([]);
    });
  });

  describe('ListInstancesQueryDto — Phase 1 enum validation (issue 2.1)', () => {
    it('accepts an empty object (uses class defaults; no filters applied)', async () => {
      const errors = await runValidate(ListInstancesQueryDto, {});
      expect(errors).toEqual([]);
    });

    describe('status', () => {
      it.each(['open', 'running', 'closed', 'finished'])(
        "accepts status='%s' (valid enum value)",
        async (value) => {
          const errors = await runValidate(ListInstancesQueryDto, { status: value });
          expect(errors).toEqual([]);
        },
      );

      it.each(['invalid', 'OPEN', 'OPENED', 'done', 'foo'])(
        "rejects status='%s' (not in the documented enum)",
        async (value) => {
          const errors = await runValidate(ListInstancesQueryDto, { status: value });
          expect(errors.length).toBeGreaterThan(0);
        },
      );
    });

    describe('difficulty', () => {
      it.each(['easy', 'medium', 'hard'])(
        "accepts difficulty='%s' (valid enum value)",
        async (value) => {
          const errors = await runValidate(ListInstancesQueryDto, { difficulty: value });
          expect(errors).toEqual([]);
        },
      );

      it.each(['invalid', 'EASY', 'extreme', 'simple'])(
        "rejects difficulty='%s' (not in the documented enum)",
        async (value) => {
          const errors = await runValidate(ListInstancesQueryDto, { difficulty: value });
          expect(errors.length).toBeGreaterThan(0);
        },
      );
    });

    describe('limit', () => {
      it.each([1, 20, 100])('accepts limit=%i', async (value) => {
        const errors = await runValidate(ListInstancesQueryDto, { limit: value });
        expect(errors).toEqual([]);
      });

      it('rejects limit=0', async () => {
        const errors = await runValidate(ListInstancesQueryDto, { limit: 0 });
        expect(errors.length).toBeGreaterThan(0);
      });

      it('rejects limit=101', async () => {
        const errors = await runValidate(ListInstancesQueryDto, { limit: 101 });
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    describe('cursor', () => {
      it('accepts a base64url cursor string', async () => {
        const errors = await runValidate(ListInstancesQueryDto, {
          cursor:
            'eyJjcmVhdGVkQXQiOiIyMDI2LTA2LTI1VDEwOjMwOjAwLjAwMFoiLCJpbnN0YW5jZUlkIjoiNjYwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIn0',
        });
        expect(errors).toEqual([]);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Phase 4 additions — cursor round-trip helpers
  // ───────────────────────────────────────────────────────────────────────

  describe('Phase 4 — strict cursor helpers (issues 2.4 / 2.9)', () => {
    describe('decodeInstanceCursor (list endpoint)', () => {
      it('accepts a valid base64url cursor', () => {
        const cursor = Buffer.from(
          JSON.stringify({
            createdAt: '2026-06-25T10:30:00.000Z',
            instanceId: '660e8400-e29b-41d4-a716-446655440001',
          }),
        ).toString('base64url');

        const decoded = decodeInstanceCursor(cursor);
        expect(decoded.createdAt).toBe('2026-06-25T10:30:00.000Z');
        expect(decoded.instanceId).toBe('660e8400-e29b-41d4-a716-446655440001');
      });

      it('also accepts legacy base64 cursors (backward-compatible decode)', () => {
        // Phase 4 (issue 2.9): runtime switched from base64 to
        // base64url but the decoder accepts both — base64url is a
        // strict subset of base64, so the existing decoder keeps
        // working for legacy clients.
        const cursor = Buffer.from(
          JSON.stringify({
            createdAt: '2026-06-25T10:30:00.000Z',
            instanceId: '660e8400-e29b-41d4-a716-446655440001',
          }),
        ).toString('base64');

        const decoded = decodeInstanceCursor(cursor);
        expect(decoded.instanceId).toBe('660e8400-e29b-41d4-a716-446655440001');
      });

      it('throws 400 on cursor with missing keys', () => {
        const cursor = Buffer.from(
          JSON.stringify({ createdAt: '2026-06-25T10:30:00.000Z' }),
        ).toString('base64url');
        expect(() => decodeInstanceCursor(cursor)).toThrow();
      });

      it('throws 400 on cursor with non-string keys', () => {
        const cursor = Buffer.from(
          JSON.stringify({
            createdAt: 12345,
            instanceId: '660e8400-e29b-41d4-a716-446655440001',
          }),
        ).toString('base64url');
        expect(() => decodeInstanceCursor(cursor)).toThrow();
      });

      it('throws 400 on cursor with non-JSON content', () => {
        const cursor = Buffer.from('not-json').toString('base64url');
        expect(() => decodeInstanceCursor(cursor)).toThrow();
      });
    });

    describe('decodeLeaderboardCursor', () => {
      it('accepts a valid base64url cursor', () => {
        const cursor = Buffer.from(
          JSON.stringify({
            rank: 5,
            instancePlayerId: '550e8400-e29b-41d4-a716-446655440099',
          }),
        ).toString('base64url');

        const decoded = decodeLeaderboardCursor(cursor);
        expect(decoded.rank).toBe(5);
        expect(decoded.instancePlayerId).toBe('550e8400-e29b-41d4-a716-446655440099');
      });

      it('throws 400 on cursor with missing keys', () => {
        const cursor = Buffer.from(JSON.stringify({ rank: 5 })).toString('base64url');
        expect(() => decodeLeaderboardCursor(cursor)).toThrow();
      });

      it('throws 400 on cursor with wrong types (rank as string)', () => {
        const cursor = Buffer.from(
          JSON.stringify({
            rank: 'not-a-number',
            instancePlayerId: '550e8400-e29b-41d4-a716-446655440099',
          }),
        ).toString('base64url');
        expect(() => decodeLeaderboardCursor(cursor)).toThrow();
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────
  // Phase 4 additions — documented enum values mirror the canonical
  // INSTANCE_STATUSES and QUIZ_DIFFICULTIES exports so a drift between
  // the DTO docstring and the runtime constants surfaces here.
  // ───────────────────────────────────────────────────────────────────────

  describe('Phase 4 — enum canonical invariants (issue 2.1)', () => {
    it('INSTANCE_STATUSES is the canonical 4-value list', () => {
      expect(INSTANCE_STATUSES).toEqual(['open', 'running', 'closed', 'finished']);
    });

    it('QUIZ_DIFFICULTIES is the canonical 3-value list', () => {
      expect(QUIZ_DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
    });
  });
});
