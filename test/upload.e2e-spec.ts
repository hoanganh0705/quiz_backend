/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
/// <reference types="jest" />
import {
  CanActivate,
  Controller,
  ExecutionContext,
  HttpCode,
  HttpStatus,
  Injectable,
  Post,
  Req,
  type INestApplication,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest';
import type { Request } from 'express';
import type { StorageAssetsRepositoryPort, UploadPurpose } from '@/core/storage';
import {
  STORAGE_PORT,
  STORAGE_ASSETS_REPOSITORY,
  StorageApplicationService,
  type StoragePort,
  type SignedUpload,
  type UploadInput,
  type UploadResult,
} from '@/core/storage';
import { UploadApplicationService } from '@/modules/upload/application/upload.application.service';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@Injectable()
class JwtAuthGuard implements CanActivate {
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
    if (!this.rows.some((r) => r.publicId === input.publicId)) {
      this.rows.push({ ...input });
    }
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

  deleteByPublicId(_publicId: string): Promise<void> {
    return Promise.resolve();
  }

  findByPublicId(
    publicId: string,
  ): Promise<Array<{ publicId: string; ownerId: string; purpose: UploadPurpose }>> {
    return Promise.resolve(this.rows.filter((r) => r.publicId === publicId));
  }
}

class FakeStoragePort implements StoragePort {
  readonly uploaded: UploadInput[] = [];
  readonly deleted: string[] = [];

  upload(input: UploadInput): Promise<UploadResult> {
    this.uploaded.push(input);
    const publicId = `quiz-app/${input.purpose}/${input.ownerId}/fake-uuid`;
    return Promise.resolve({
      publicId,
      url: `https://fake.test/${publicId}`,
      bytes: input.bytes,
      format: 'webp',
      width: 512,
      height: 512,
    });
  }

  delete(publicId: string): Promise<void> {
    this.deleted.push(publicId);
    return Promise.resolve();
  }

  deriveUrl(publicId: string, _purpose: 'avatar' | 'quiz'): string {
    return `https://fake.test/derived/${publicId}`;
  }

  ping(): Promise<void> {
    return Promise.resolve();
  }

  createSignedUpload(input: {
    ownerId: string;
    purpose: 'avatar' | 'quiz';
    expiresInSeconds: number;
  }): Promise<SignedUpload> {
    const publicId = `quiz-app/${input.purpose}/${input.ownerId}/signed-fake-uuid`;
    const timestamp = Math.floor(Date.now() / 1000) + input.expiresInSeconds;
    return Promise.resolve({
      uploadUrl: `https://fake.test/${publicId}`,
      publicId,
      expiresAt: new Date(timestamp * 1000).toISOString(),
      apiKey: 'fake-key',
      signature: 'fake-signature',
      timestamp,
      folder: `quiz-app/${input.purpose}`,
    });
  }
}

@Controller('upload-fixture')
@UseGuards(JwtAuthGuard)
class UploadFixtureController {
  constructor(private readonly uploadApp: UploadApplicationService) {}

  @Post()
  async uploadFile(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<{ publicId: string }> {
    const body = req.body as { purpose?: string; file?: Express.Multer.File };
    const file = body.file;
    const result = await this.uploadApp.uploadAvatarOrQuizCover({
      ownerId: user.sub,
      purpose: (body.purpose ?? 'avatar') as 'avatar' | 'quiz',
      file,
    });
    return { publicId: result.publicId };
  }

  @Post('sign')
  async signUpload(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<{ publicId: string }> {
    const body = req.body as { purpose?: string; expiresInSeconds?: number };
    const result = await this.uploadApp.signUpload({
      ownerId: user.sub,
      purpose: (body.purpose ?? 'avatar') as 'avatar' | 'quiz',
      expiresInSeconds: body.expiresInSeconds,
    });
    return { publicId: result.publicId };
  }

  @Post('bind')
  @HttpCode(HttpStatus.OK)
  async bindUpload(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<{ publicId: string; bound: true; purpose: string; ownerId: string }> {
    const body = req.body as { publicId?: string; purpose?: string };
    await this.uploadApp.bindAsset({
      ownerId: user.sub,
      publicId: body.publicId ?? '',
      purpose: (body.purpose ?? 'avatar') as 'avatar' | 'quiz',
    });
    return {
      publicId: body.publicId ?? '',
      bound: true,
      purpose: body.purpose ?? 'avatar',
      ownerId: user.sub,
    };
  }
}

const USER_A = '0190b1c2-7f3a-7aaa-bbbb-aaaaaaaaaaaa';

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'avatar.png',
  encoding: '7bit',
  mimetype: 'image/png',
  size: 1024,
  buffer: Buffer.from('fake-png-bytes'),
  destination: '',
  filename: '',
  path: '',
  stream: undefined as never,
  ...overrides,
});

describe('Upload controller endpoints — e2e', () => {
  let app: INestApplication;
  let repo: InMemoryStorageAssetsRepository;
  let storage: FakeStoragePort;

  beforeEach(async () => {
    repo = new InMemoryStorageAssetsRepository();
    storage = new FakeStoragePort();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      controllers: [UploadFixtureController],
      providers: [
        { provide: STORAGE_PORT, useValue: storage },
        { provide: STORAGE_ASSETS_REPOSITORY, useValue: repo },
        StorageApplicationService,
        UploadApplicationService,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  const http = () => request(app.getHttpServer() as App);

  describe('POST /upload-fixture (uploadAvatarOrQuizCover)', () => {
    it('returns 201 and binds owner on happy path', async () => {
      const res = await http()
        .post('/upload-fixture')
        .set('X-Test-User', USER_A)
        .send({ purpose: 'avatar', file: makeFile() });
      expect(res.status).toBe(201);
      expect(res.body.publicId).toMatch(/^quiz-app\/avatar\//);
      expect(storage.uploaded).toHaveLength(1);
    });

    it('returns 400 when file is missing', async () => {
      const res = await http()
        .post('/upload-fixture')
        .set('X-Test-User', USER_A)
        .send({ purpose: 'avatar' });
      expect(res.status).toBe(400);
    });

    it('returns 401 when X-Test-User is missing', async () => {
      const res = await http().post('/upload-fixture').send({});
      expect(res.status).toBe(401);
    });

    it('uploads with quiz purpose', async () => {
      const res = await http()
        .post('/upload-fixture')
        .set('X-Test-User', USER_A)
        .send({ purpose: 'quiz', file: makeFile() });
      expect(res.status).toBe(201);
      expect(res.body.publicId).toMatch(/^quiz-app\/quiz\//);
    });
  });

  describe('POST /upload-fixture/sign (signUpload)', () => {
    it('returns 201 with signed envelope', async () => {
      const res = await http()
        .post('/upload-fixture/sign')
        .set('X-Test-User', USER_A)
        .send({ purpose: 'avatar' });
      expect(res.status).toBe(201);
      expect(res.body.publicId).toMatch(/^quiz-app\/avatar\//);
    });

    it('returns 401 when X-Test-User is missing', async () => {
      const res = await http().post('/upload-fixture/sign').send({ purpose: 'avatar' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /upload-fixture/bind (bindAsset)', () => {
    beforeEach(() => {
      repo.rows.push({
        publicId: `quiz-app/avatar/${USER_A}/pre-seeded`,
        ownerId: USER_A,
        purpose: 'avatar',
      });
    });

    it('returns 200 when asset exists and binds', async () => {
      const res = await http()
        .post('/upload-fixture/bind')
        .set('X-Test-User', USER_A)
        .send({ publicId: `quiz-app/avatar/${USER_A}/pre-seeded`, purpose: 'avatar' });
      expect(res.status).toBe(200);
    });

    it('returns 404 when asset does not exist', async () => {
      const res = await http()
        .post('/upload-fixture/bind')
        .set('X-Test-User', USER_A)
        .send({ publicId: 'quiz-app/avatar/never-uploaded', purpose: 'avatar' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('UPLOAD_ASSET_NOT_FOUND');
    });

    it('returns 401 when X-Test-User is missing', async () => {
      const res = await http()
        .post('/upload-fixture/bind')
        .send({ publicId: `quiz-app/avatar/${USER_A}/pre-seeded`, purpose: 'avatar' });
      expect(res.status).toBe(401);
    });
  });
});
