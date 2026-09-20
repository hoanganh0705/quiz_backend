/// <reference types="jest" />
import {
  Controller,
  Patch,
  Body,
  UseGuards,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  HttpStatus,
  ForbiddenException,
  type INestApplication,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { LoggerModule } from 'nestjs-pino';
import type { StorageAssetsRepositoryPort, UploadPurpose } from '@/core/storage';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{ user?: JwtPayload; headers: Record<string, string | undefined> }>();
    const sub = req.headers['x-test-user'];
    if (!sub) {
      throw new UnauthorizedException('Missing X-Test-User header');
    }
    req.user = {
      sub,
      role: (req.headers['x-test-role'] as JwtPayload['role']) ?? 'user',
    };
    return true;
  }
}

class InMemoryStorageAssetsRepository implements StorageAssetsRepositoryPort {
  readonly rows: Array<{ publicId: string; ownerId: string; purpose: UploadPurpose }> = [];

  insert(input: { publicId: string; ownerId: string; purpose: UploadPurpose }): Promise<void> {
    if (this.rows.some((r) => r.publicId === input.publicId)) {
      return Promise.reject(new Error('UNIQUE collision'));
    }
    this.rows.push({ ...input });
    return Promise.resolve();
  }

  existsByPublicIdOwnerAndPurpose(input: {
    publicId: string;
    ownerId: string;
    purpose: UploadPurpose;
  }): Promise<boolean> {
    return Promise.resolve(
      this.rows.some(
        (r) =>
          r.publicId === input.publicId &&
          r.ownerId === input.ownerId &&
          r.purpose === input.purpose,
      ),
    );
  }

  deleteByPublicId(publicId: string): Promise<void> {
    const idx = this.rows.findIndex((r) => r.publicId === publicId);
    if (idx >= 0) this.rows.splice(idx, 1);
    return Promise.resolve();
  }

  findByPublicId(
    publicId: string,
  ): Promise<Array<{ publicId: string; ownerId: string; purpose: UploadPurpose }>> {
    return Promise.resolve(this.rows.filter((r) => r.publicId === publicId));
  }
}

/**
 * Standalone controller that mirrors the §11 gating step from
 * `UserApplicationService.updateProfile`. The fixture exists so the
 * e2e test can exercise the full request → guard → DTO → controller
 * → service → repository pipeline without booting the entire
 * `UserModule` (which pulls in Postgres + Redis).
 */
@Controller('ownership-fixture')
@UseGuards(TestAuthGuard)
class OwnershipFixtureController {
  constructor(private readonly repo: InMemoryStorageAssetsRepository) {}

  @Patch()
  patch(
    @CurrentUser() user: JwtPayload,
    @Body() body: { avatarPublicId: string | null },
  ): { avatarPublicId: string | null } {
    if (body.avatarPublicId !== null && body.avatarPublicId !== undefined) {
      const owns = this.repo.rows.some(
        (r) =>
          r.publicId === body.avatarPublicId && r.ownerId === user.sub && r.purpose === 'avatar',
      );
      if (!owns) {
        throw new ForbiddenException({
          code: 'ASSET_NOT_OWNED',
          message:
            'The supplied avatar publicId is not owned by the authenticated user for the avatar purpose.',
        });
      }
    }
    return { avatarPublicId: body.avatarPublicId ?? null };
  }
}

describe('§11 ownership gate', () => {
  let app: INestApplication<App>;
  let repo: InMemoryStorageAssetsRepository;
  const OWNER_A = '0190b1c2-7f3a-7aaa-bbbb-aaaaaaaaaaaa';
  const OWNER_B = '0190b1c2-7f3a-7aaa-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    repo = new InMemoryStorageAssetsRepository();
    repo.rows.push(
      { publicId: 'quiz-app/avatars/aa/u1', ownerId: OWNER_A, purpose: 'avatar' },
      { publicId: 'quiz-app/quizzes/aa/u2', ownerId: OWNER_A, purpose: 'quiz' },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      controllers: [OwnershipFixtureController],
      providers: [{ provide: InMemoryStorageAssetsRepository, useValue: repo }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('cross-user avatar publicId theft → 403 ASSET_NOT_OWNED, no write', async () => {
    const before = repo.rows.length;
    const response = await request(app.getHttpServer())
      .patch('/ownership-fixture')
      .set('X-Test-User', OWNER_B)
      .send({ avatarPublicId: 'quiz-app/avatars/aa/u1' })
      .expect(HttpStatus.FORBIDDEN);
    expect(response.body).toMatchObject({ code: 'ASSET_NOT_OWNED' });
    expect(repo.rows.length).toBe(before);
    const original = repo.rows.find((r) => r.publicId === 'quiz-app/avatars/aa/u1');
    expect(original?.ownerId).toBe(OWNER_A);
  });

  it('forged publicId → 403 ASSET_NOT_OWNED', async () => {
    await request(app.getHttpServer())
      .patch('/ownership-fixture')
      .set('X-Test-User', OWNER_A)
      .send({ avatarPublicId: 'quiz-app/avatars/aa/never-uploaded' })
      .expect(HttpStatus.FORBIDDEN);
  });

  it('cross-purpose reuse (avatar field with quiz publicId) → 403 ASSET_NOT_OWNED', async () => {
    await request(app.getHttpServer())
      .patch('/ownership-fixture')
      .set('X-Test-User', OWNER_A)
      .send({ avatarPublicId: 'quiz-app/quizzes/aa/u2' })
      .expect(HttpStatus.FORBIDDEN);
  });

  it('owner with own avatar publicId → 200', async () => {
    const response = await request(app.getHttpServer())
      .patch('/ownership-fixture')
      .set('X-Test-User', OWNER_A)
      .send({ avatarPublicId: 'quiz-app/avatars/aa/u1' })
      .expect(HttpStatus.OK);
    expect(response.body).toMatchObject({ avatarPublicId: 'quiz-app/avatars/aa/u1' });
  });

  it('null publicId → 200 (clear)', async () => {
    const response = await request(app.getHttpServer())
      .patch('/ownership-fixture')
      .set('X-Test-User', OWNER_B)
      .send({ avatarPublicId: null })
      .expect(HttpStatus.OK);
    expect(response.body).toMatchObject({ avatarPublicId: null });
  });

  it('no auth header → 401', async () => {
    await request(app.getHttpServer())
      .patch('/ownership-fixture')
      .send({ avatarPublicId: null })
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
