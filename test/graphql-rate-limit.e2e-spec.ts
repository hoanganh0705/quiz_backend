/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';

import { GraphQLModule } from '@/core/graphql/graphql.module';
import { QuizGraphqlResolver } from '@/modules/quiz/graphql/quiz.graphql-resolver';
import { QuizzesBundleService } from '@/modules/quiz/application/quizzes-bundle.service';
import { graphqlConfig, jwtConfig } from '@/core/config';

/**
 * The endpoint limiter gets its own suite because it buckets by client, and
 * every supertest request in the other suites arrives from the same loopback
 * address. Sharing one app would have those tests consume a single shared
 * window and interfere with each other.
 */
describe('GraphQL endpoint rate limit (e2e)', () => {
  let app: INestApplication<App>;

  const emptyBundle = {
    items: { items: [], pagination: { limit: 20, nextCursor: null, hasNextPage: false } },
    popular: [],
    trending: [],
    categories: [],
    tags: [],
  };

  const bundleService = { getBundle: jest.fn().mockResolvedValue(emptyBundle) };

  beforeAll(async () => {
    // `graphqlConfig` reads `process.env` at call time rather than through
    // `ConfigModule`'s injection, so the value has to sit on the process
    // itself for the driver factory to observe it.
    process.env.GRAPHQL_RATE_LIMIT = '2';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [graphqlConfig, jwtConfig] }),
        GraphQLModule,
      ],
      providers: [QuizGraphqlResolver, { provide: QuizzesBundleService, useValue: bundleService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.GRAPHQL_RATE_LIMIT;
  });

  const post = (body: Record<string, unknown>, clientIp: string) =>
    request(app.getHttpServer()).post('/graphql').set('x-forwarded-for', clientIp).send(body);

  const query = { query: '{ quizzesBundle { pageInfo { limit } } }' };

  it('serves the first two operations of the window', async () => {
    const first = await post(query, '203.0.113.10');
    const second = await post(query, '203.0.113.10');

    expect(first.status).toBe(200);
    expect(first.body.errors).toBeUndefined();
    expect(second.status).toBe(200);
    expect(second.body.errors).toBeUndefined();
  });

  it('rejects the operation that exceeds the window', async () => {
    const response = await post(query, '203.0.113.10');

    expect(response.status).toBe(429);
    expect(response.body.data).toBeUndefined();
    expect(response.body.errors[0].extensions.code).toBe('RATE_LIMITED');
    expect(response.body.errors[0].extensions.status).toBe(429);
  });

  it('keeps the window per client rather than global', async () => {
    const response = await post(query, '203.0.113.99');

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
  });
});
