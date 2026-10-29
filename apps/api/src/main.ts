import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { setupOpenApi } from './openapi/openapi';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );

  setupOpenApi(app);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
