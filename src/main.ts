import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
