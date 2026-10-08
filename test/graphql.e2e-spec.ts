/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import request from 'supertest';
import type { App } from 'supertest/types';

import { GraphQLModule } from '@/core/graphql/graphql.module';
import { QuizGraphqlResolver } from '@/modules/quiz/graphql/quiz.graphql-resolver';
import { QuizzesBundleService } from '@/modules/quiz/application/quizzes-bundle.service';
import { graphqlConfig, jwtConfig } from '@/core/config';

const emptyBundle = {
  items: { items: [], pagination: { limit: 20, nextCursor: null, hasNextPage: false } },
  popular: [],
  trending: [],
  categories: [],
  tags: [],
};

describe('GraphQL server (e2e)', () => {
  let app: INestApplication<App>;
  let schema: GraphQLSchemaHost['schema'];

  const bundleService = { getBundle: jest.fn().mockResolvedValue(emptyBundle) };

  beforeAll(async () => {
    // `graphqlConfig` reads `process.env` at call time rather than through
    // `ConfigModule`'s injection, so the value has to sit on the process
    // itself for the driver factory to observe it.
    process.env.GRAPHQL_RATE_LIMIT_DISABLED = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [graphqlConfig, jwtConfig] }),
        GraphQLModule,
      ],
      providers: [QuizGraphqlResolver, { provide: QuizzesBundleService, useValue: bundleService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    schema = app.get(GraphQLSchemaHost).schema;
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.GRAPHQL_RATE_LIMIT_DISABLED;
  });

  beforeEach(() => {
    bundleService.getBundle.mockClear();
  });

  const post = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/graphql').send(body);

  const debug = async (body: Record<string, unknown>) => {
    const response = await post(body);
    if (response.status !== 200) {
      console.log('DEBUG', JSON.stringify(response.body, null, 2));
    }
    return response;
  };

  it('generates a schema exposing the directory bundle', () => {
    const sdl = printSchema(schema);
    expect(sdl).toContain('quizzesBundle');
    expect(sdl).toContain('type QuizzesBundle');
    expect(sdl).toContain('directive @requiresAuth');
  });

  it('serves the bundle over POST /graphql', async () => {
    const response = await debug({
      query: `{
        quizzesBundle {
          items { quizId title slug averageRating }
          pageInfo { limit hasNextPage nextCursor }
          categories { rank categoryId name slug }
        }
      }`,
    });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.quizzesBundle).toEqual({
      items: [],
      pageInfo: { limit: 20, hasNextPage: false, nextCursor: null },
      categories: [],
    });
  });

  it('rejects a query deeper than the configured maximum', async () => {
    const response = await post({
      query: `{
        quizzesBundle {
          items {
            creator { userId username displayName avatarUrl }
          }
        }
      }`,
    });

    // Depth of this query is within the limit, so it must be accepted.
    expect(response.status).toBe(200);
  });

  it('reports a problem code for an unknown field', async () => {
    const response = await post({ query: '{ quizzesBundle { notARealField } }' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toBeDefined();
  });

  it('surfaces a domain failure as a redacted internal error', async () => {
    bundleService.getBundle.mockRejectedValueOnce(new Error('connect ECONNREFUSED db:5432'));

    const response = await post({ query: '{ quizzesBundle { items { quizId } } }' });

    expect(response.status).toBe(200);
    expect(response.body.errors[0].extensions.code).toBe('GRAPHQL_INTERNAL_ERROR');
    expect(response.body.errors[0].message).toBe('An unexpected error occurred.');
    expect(response.body.errors[0].message).not.toContain('ECONNREFUSED');
  });

  it('exposes the limit arguments on the query', async () => {
    const response = await post({
      query: `query($limit: Int) {
        quizzesBundle(limit: $limit) { pageInfo { limit } }
      }`,
      variables: { limit: 5 },
    });

    expect(response.status).toBe(200);
    expect(bundleService.getBundle).toHaveBeenCalledWith(
      expect.objectContaining({ filters: expect.objectContaining({ limit: 5 }) }),
    );
  });
});
