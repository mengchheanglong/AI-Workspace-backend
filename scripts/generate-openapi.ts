import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { HealthController } from '../src/modules/health/health.controller';
import { HealthService } from '../src/modules/health/health.service';
import { createOpenApiDocument } from '../src/openapi';

// Offline metadata-only app: no database connection, .env, provider call, or listening socket.
// Register new public controllers here as the API grows, and test path coverage.
@Module({ controllers: [HealthController], providers: [{ provide: HealthService, useValue: {} }] })
class OpenApiModule {}

async function generate(): Promise<void> {
  const app = await NestFactory.create(OpenApiModule, { logger: false });
  try {
    app.setGlobalPrefix('api/v1');
    const document = createOpenApiDocument(app);
    await mkdir('docs', { recursive: true });
    await writeFile('docs/openapi.json', `${JSON.stringify(document, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void generate().catch(() => {
  process.stderr.write('OpenAPI generation failed.\n');
  process.exitCode = 1;
});
