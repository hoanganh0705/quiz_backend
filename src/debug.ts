import { repl } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await repl(AppModule, {
    preview: false,
  });
}
void bootstrap();
