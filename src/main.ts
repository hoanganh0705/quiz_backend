import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true }); // bufferLogs: true để đảm bảo log được ghi lại ngay cả khi app chưa sẵn sàng để xử lý request, tránh mất log quan trọng trong quá trình khởi động
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const rawCorsOrigins = configService.get<string>('CORS_ORIGINS') ?? '';
  const corsOrigins = rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : isProduction ? false : true,
    credentials: true,
  });
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks(); // enableShutdownHooks để NestJS có thể lắng nghe các sự kiện shutdown của hệ thống, giúp thực hiện các công việc dọn dẹp trước khi ứng dụng tắt, như đóng kết nối database, giải phóng tài nguyên, v.v.

  // set global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // tự động strip các field không có trong DTO
      forbidNonWhitelisted: true, // throw error nếu có field lạ
      transform: true, // tự động transform type, ví dụ query param là string nhưng DTO định nghĩa là number thì sẽ tự động transform sang number
    }),
  );
  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
}
void bootstrap();
