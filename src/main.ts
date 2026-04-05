import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // set global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // tự động strip các field không có trong DTO
      forbidNonWhitelisted: true, // throw error nếu có field lạ
      transform: true, // tự động transform type
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
