import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { JsonLogger } from './common/http/json-logger';
import { requestContextMiddleware } from './common/http/request-context';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { resolveHttpEndpoint } from './config/http-endpoint';
import { loadRuntimeSecrets } from './config/runtime-secrets';
import { setupOpenApi } from './openapi/openapi';

async function bootstrap() {
  await loadRuntimeSecrets();
  const { AppModule } = await import('./app.module.js');
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });

  app.setGlobalPrefix('v1');
  app.enableShutdownHooks();
  app.use(requestContextMiddleware);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
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

void bootstrap().catch((error: unknown) => {
  new JsonLogger().fatal(error, 'Bootstrap');
  process.exit(1);
});
