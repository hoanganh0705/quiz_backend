/* eslint-disable @typescript-eslint/require-await */
/// <reference types="jest" />
import { Controller, Get, INestApplication, Inject, Post } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiResponse } from '@/common/responses/api-response';
import { EMAIL_PROVIDER, type EmailProvider } from '@/common/ports/email.provider';

interface EnqueueCall {
  readonly method: 'enqueueVerificationEmail' | 'enqueuePasswordResetEmail';
  readonly email: string;
  readonly token: string;
  readonly userId?: string;
}

const makeFakeEmailProvider = (): EmailProvider & { calls: EnqueueCall[] } => {
  const calls: EnqueueCall[] = [];
  return {
    calls,
    enqueueVerificationEmail: jest.fn(async (email: string, token: string, userId?: string) => {
      calls.push({ method: 'enqueueVerificationEmail', email, token, userId });
    }),
    enqueuePasswordResetEmail: jest.fn(async (email: string, token: string, userId: string) => {
      calls.push({ method: 'enqueuePasswordResetEmail', email, token, userId });
    }),
  };
};

@Controller('email-e2e-fixture')
class EmailFixtureController {
  constructor(@Inject(EMAIL_PROVIDER) private readonly email: EmailProvider) {}

  @Post('verification')
  async sendVerification(): Promise<unknown> {
    await this.email.enqueueVerificationEmail('user@example.com', 'tok-1', 'user-1');
    return ApiResponse.ok({});
  }

  @Post('password-reset')
  async sendPasswordReset(): Promise<unknown> {
    await this.email.enqueuePasswordResetEmail('user@example.com', 'tok-2', 'user-1');
    return ApiResponse.ok({});
  }

  @Get('provider')
  async getProviderName(): Promise<unknown> {
    return ApiResponse.ok({ provider: 'EmailProvider' });
  }
}

describe('EmailProvider — e2e parity', () => {
  let app: INestApplication;
  let fakeProvider: ReturnType<typeof makeFakeEmailProvider>;

  beforeAll(async () => {
    fakeProvider = makeFakeEmailProvider();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      controllers: [EmailFixtureController],
      providers: [{ provide: EMAIL_PROVIDER, useValue: fakeProvider }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('boots the fixture', () => {
    expect(app).toBeDefined();
  });

  it('routes enqueueVerificationEmail through the injected EmailProvider', async () => {
    const res = await request(app.getHttpServer() as App).post('/email-e2e-fixture/verification');
    expect(res.status).toBe(201);
    expect(fakeProvider.calls).toContainEqual({
      method: 'enqueueVerificationEmail',
      email: 'user@example.com',
      token: 'tok-1',
      userId: 'user-1',
    });
  });

  it('routes enqueuePasswordResetEmail through the injected EmailProvider', async () => {
    const res = await request(app.getHttpServer() as App).post('/email-e2e-fixture/password-reset');
    expect(res.status).toBe(201);
    expect(fakeProvider.calls).toContainEqual({
      method: 'enqueuePasswordResetEmail',
      email: 'user@example.com',
      token: 'tok-2',
      userId: 'user-1',
    });
  });
});
