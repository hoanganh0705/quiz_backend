import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser'; // cookie-parser is a middleware that parses cookies attached to the client request object. It populates req.cookies with an object keyed by the cookie names. This is useful for handling authentication tokens, session IDs, and other data stored in cookies. By using cookie-parser, we can easily access and manage cookies in our NestJS application, especially when dealing with cross-origin requests where cookies are often used for maintaining user sessions.
import helmet from 'helmet'; // Helmet is a collection of middleware functions that help secure Express apps by setting various HTTP headers. It can help protect against common web vulnerabilities such as XSS, clickjacking, and MIME-sniffing attacks.
import { isSwaggerEnabled, setupSwagger, buildSwaggerConfig } from './core/swagger/swagger.config';
import { serverConfig, appConfig, swaggerConfig } from './core/config';

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

  await app.listen(server.port);
}
void bootstrap();
