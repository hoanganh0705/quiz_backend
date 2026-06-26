import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { injectCookieParams } from '@/common/swagger/cookie-params.plugin';

const SWAGGER_PATH = 'docs';
const AUTH_SECURITY_NAME = 'BearerAuth';

export const setupSwagger = (app: INestApplication, config: SwaggerConfig): void => {
  const builder = new DocumentBuilder()
    .setTitle(config.title)
    .setDescription(config.description)
    .setVersion(config.version)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: `Paste the JWT access token returned from \`/auth/login\` or \`/auth/refresh-token\``,
      },
      AUTH_SECURITY_NAME,
    )
    .addTag('auth', 'Registration, login, logout, and email verification')
    .addTag('users', 'Authenticated user profile management')
    .addTag('categories', 'Quiz category browsing and management')
    .addTag('tags', 'Quiz tag browsing and management')
    .addTag('quizzes', 'Quiz CRUD, versioning, and question management')
    .addTag('attempts', 'Quiz attempt lifecycle (start, answer, abandon, complete)')
    .addTag('bookmarks', 'Bookmark collections and saved quizzes')
    .addTag('reviews', 'Quiz ratings and reviews')
    .addTag('tournaments', 'Tournament management and leaderboard')
    .addTag('instances', 'Live quiz instance management');

  for (const server of config.servers) {
    builder.addServer(server);
  }

  const document = SwaggerModule.createDocument(app, builder.build());
  injectCookieParams(document);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs/openapi.json',
    customSiteTitle: `${config.title} — API Reference`,
  });
};

export const isSwaggerEnabled = (nodeEnv: string, swaggerEnabled?: string): boolean => {
  if (swaggerEnabled?.trim().toLowerCase() === 'true') {
    return true;
  }
  return nodeEnv !== 'production';
};

export const buildSwaggerConfig = (overrides: Partial<SwaggerConfig> = {}): SwaggerConfig => ({
  title: overrides.title ?? 'Quiz API',
  description: overrides.description ?? 'REST API for the quiz application',
  version: overrides.version ?? '1.0',
  servers: overrides.servers ?? [],
  globalPrefix: overrides.globalPrefix ?? 'api/v1',
});

export type SwaggerConfig = {
  title: string;
  description: string;
  version: string;
  servers: string[];
  globalPrefix: string;
};

export { AUTH_SECURITY_NAME };
