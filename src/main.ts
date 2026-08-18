import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser'; // cookie-parser is a middleware that parses cookies attached to the client request object. It populates req.cookies with an object keyed by the cookie names. This is useful for handling authentication tokens, session IDs, and other data stored in cookies. By using cookie-parser, we can easily access and manage cookies in our NestJS application, especially when dealing with cross-origin requests where cookies are often used for maintaining user sessions.
import helmet from 'helmet'; // Helmet is a collection of middleware functions that help secure Express apps by setting various HTTP headers. It can help protect against common web vulnerabilities such as XSS, clickjacking, and MIME-sniffing attacks.
import express from 'express';
import { isSwaggerEnabled, setupSwagger, buildSwaggerConfig } from './core/swagger/swagger.config';
import { serverConfig, appConfig, swaggerConfig } from './core/config';
import { RedisIoAdapter } from './core/redis/redis-io.adapter';

/**
 * Toggle the Socket.IO Redis adapter on/off. The adapter is a Phase 3
 * production deployment concern: in single-instance mode it is still
 * wired up (it's harmless and lets dev match prod), but the operator
 * can opt out via `DISABLE_REDIS_SOCKET_ADAPTER=true` for environments
 * where Redis is unavailable (CI, local debugging without Redis).
 */
const isRedisSocketAdapterEnabled = process.env.DISABLE_REDIS_SOCKET_ADAPTER !== 'true';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true }); // bufferLogs: true ensures logs are written even when the app is not ready to handle requests, preventing important logs from being lost during startup
  const server = serverConfig();
  const appCfg = appConfig();
  const swagger = swaggerConfig();
  const isProduction = server.nodeEnv === 'production';

  app.enableCors({
    origin: server.corsOrigins.length > 0 ? server.corsOrigins : isProduction ? false : true, // if CORS_ORIGINS env var is set, use it; otherwise, if in production, disable CORS; if in development, allow all origins
    credentials: true, // allow cookies to be sent in CORS requests, useful when frontend and backend are on different domains/ports and you want to maintain sessions or authentication state via cookies
  });

  const swaggerEnabled = isSwaggerEnabled(server.nodeEnv, swagger.enabled ? 'true' : undefined);

  app.use(
    helmet({
      // Swagger UI relies on inline scripts/styles that default CSP blocks.
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );
  app.use(cookieParser());

  /**
   * Phase 3 — explicit JSON body limit.
   *
   * Now that uploads go through `multipart/form-data` (per-route,
   * `FileInterceptor` capped at 8 MB), the JSON body parser only has
   * to carry control fields (`avatarPublicId`, etc.). 1 MB is a
   * generous ceiling that still fails loud on accidentally-base64'd
   * payloads. Multipart bodies bypass this limit and are governed by
   * the per-purpose cap in `UPLOAD_POLICY`.
   */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.set('trust proxy', server.trustProxy); // set up trust proxy so that app can correctly identify client IP and protocol when behind a proxy, which is important for security and logging purposes
  app.setGlobalPrefix('api/v1');

  if (swaggerEnabled) {
    setupSwagger(
      app,
      buildSwaggerConfig({
        title: appCfg.name,
        description: appCfg.description,
        version: appCfg.version,
        servers: [`${appCfg.url || `http://localhost:${server.port}`}/api/v1`],
      }),
    );
  }
  app.enableShutdownHooks(); // enableShutdownHooks allows NestJS to listen for system shutdown events, performing cleanup tasks before the application stops

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not defined in the DTO
      forbidNonWhitelisted: true, // Reject requests with unknown properties
      transform: true, // Auto-transform payload types to match DTO declarations
    }),
  );

  /**
   * Phase 3: Socket.IO Redis adapter.
   *
   * When REDIS is reachable and the operator has not explicitly
   * disabled the adapter via `DISABLE_REDIS_SOCKET_ADAPTER=true`,
   * `RedisIoAdapter` replaces the default in-process Socket.IO
   * adapter with the Redis-backed one. This is what makes
   * `server.to(room).emit(...)` actually cross-instance; without it,
   * horizontally-scaled deployments silently drop events for clients
   * not on the originating replica.
   *
   * The adapter throws on the first `createIOServer()` call if Redis
   * is unreachable, which surfaces the misconfiguration at boot time
   * rather than mid-request. See the operational runbook for
   * guidance on sizing / monitoring the Redis instance.
   */
  if (isRedisSocketAdapterEnabled) {
    app.useWebSocketAdapter(new RedisIoAdapter(app));
  }

  await app.listen(server.port);
}
void bootstrap();
