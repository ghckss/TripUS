import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { createOpenApiDocument } from '../openapi/openapi';

async function generateOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('v1');
  await app.init();

  const document = createOpenApiDocument(app);
  const outputPath = resolve(
    __dirname,
    '../../../../packages/contracts/openapi.json',
  );
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  await app.close();
  console.log(`OpenAPI document written to ${outputPath}`);
}

void generateOpenApi();
