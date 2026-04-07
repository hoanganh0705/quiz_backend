import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.enableCors();
  app.use(cookieParser());

  // set global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // tự động strip các field không có trong DTO
      forbidNonWhitelisted: true, // throw error nếu có field lạ
      transform: true, // tự động transform type
    }),
  );
  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? 3000);

  await app.listen(port);
}
void bootstrap();
