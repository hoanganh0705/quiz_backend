import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser'; // cookie-parser is a middleware that parses cookies attached to the client request object. It populates req.cookies with an object keyed by the cookie names. This is useful for handling authentication tokens, session IDs, and other data stored in cookies. By using cookie-parser, we can easily access and manage cookies in our NestJS application, especially when dealing with cross-origin requests where cookies are often used for maintaining user sessions.
import helmet from 'helmet'; // Helmet is a collection of middleware functions that help secure Express apps by setting various HTTP headers. It can help protect against common web vulnerabilities such as cross-site scripting (XSS), clickjacking, and MIME-sniffing attacks. By using Helmet in our NestJS application, we can enhance the security of our API by adding these protective headers to all responses, making it harder for attackers to exploit vulnerabilities in our app.
import { isSwaggerEnabled, setupSwagger, buildSwaggerConfig } from './core/swagger/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true }); // bufferLogs: true để đảm bảo log được ghi lại ngay cả khi app chưa sẵn sàng để xử lý request, tránh mất log quan trọng trong quá trình khởi động
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const trustProxy = configService.get<boolean>('TRUST_PROXY') ?? false; // default to false if not set, meaning the app will not trust proxy headers unless explicitly configured to do so, which is a safer default for security reasons. If your app is behind a proxy (like Nginx or a cloud load balancer), you should set TRUST_PROXY to true to ensure correct handling of client IP and protocol information.
  const rawCorsOrigins = configService.get<string>('CORS_ORIGINS') ?? ''; // CORS_ORIGINS env var should be a comma-separated list of allowed origins for CORS, e.g. "https://example.com,https://another.com". If it's not set, it will default to an empty string, which means no specific origins are allowed and the app will fall back to allowing all origins in development or disallowing all origins in production.
  const corsOrigins = rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : isProduction ? false : true, // if CORS_ORIGINS env var is set, use it; otherwise, if in production, disable CORS; if in development, allow all origins
    credentials: true, // allow cookies to be sent in CORS requests, useful when frontend and backend are on different domains/ports and you want to maintain sessions or authentication state via cookies
  });
  const swaggerEnabled = isSwaggerEnabled(
    configService.get<string>('NODE_ENV') ?? 'development',
    configService.get<string>('SWAGGER_ENABLED'),
  );

  app.use(
    helmet({
      // Swagger UI relies on inline scripts/styles that default CSP blocks.
      contentSecurityPolicy: swaggerEnabled ? false : undefined,
    }),
  );
  app.use(cookieParser());
  app.set('trust proxy', trustProxy); // set up trust proxy so that app can correctly identify client IP and protocol when behind a proxy, which is important for security and logging purposes. If TRUST_PROXY env var is true, it will trust the X-Forwarded-* headers from the proxy; if false, it will not trust those headers and will use the direct connection info instead.
  app.setGlobalPrefix('api/v1');
  if (swaggerEnabled) {
    setupSwagger(
      app,
      buildSwaggerConfig({
        title: configService.get<string>('APP_NAME') ?? 'Quiz API',
        description:
          configService.get<string>('APP_DESCRIPTION') ?? 'REST API for the quiz application',
        version: configService.get<string>('APP_VERSION') ?? '1.0',
        servers: [
          `${configService.get<string>('APP_URL') ?? `http://localhost:${configService.get<number>('PORT') ?? 8080}`}/api/v1`,
        ],
      }),
    );
  }
  app.enableShutdownHooks(); // enableShutdownHooks để NestJS có thể lắng nghe các sự kiện shutdown của hệ thống, giúp thực hiện các công việc dọn dẹp trước khi ứng dụng tắt, như đóng kết nối database, giải phóng tài nguyên, v.v.

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not defined in the DTO
      forbidNonWhitelisted: true, // Reject requests with unknown properties
      transform: true, // Auto-transform payload types to match DTO declarations
    }),
  );
  const port = configService.get<number>('PORT') ?? 8080;

  await app.listen(port);
}
void bootstrap();
