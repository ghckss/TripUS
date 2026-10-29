import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

const openApiConfig = new DocumentBuilder()
  .setTitle('TripUS API')
  .setDescription('TripUS mobile application API')
  .setVersion('0.1.0')
  .build();

export function createOpenApiDocument(
  app: INestApplication,
): OpenAPIObject {
  return SwaggerModule.createDocument(app, openApiConfig);
}

export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup('docs', app, createOpenApiDocument(app));
}
