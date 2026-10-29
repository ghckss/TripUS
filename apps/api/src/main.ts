import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { resolveHttpEndpoint } from './config/http-endpoint';
import { loadRuntimeSecrets } from './config/runtime-secrets';
import { setupOpenApi } from './openapi/openapi';

async function bootstrap() {
  await loadRuntimeSecrets();
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

  const endpoint = resolveHttpEndpoint(process.env);
  await app.listen(endpoint.port, endpoint.host);
}

void bootstrap();
