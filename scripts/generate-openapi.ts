import 'reflect-metadata';
import { mkdir, writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { HealthController } from '../src/modules/health/health.controller';
import { HealthService } from '../src/modules/health/health.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { SessionService } from '../src/modules/auth/services/session.service';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';
import { ProjectsController } from '../src/modules/projects/projects.controller';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { ProjectMembersController } from '../src/modules/projects/project-members.controller';
import { ProjectMembersService } from '../src/modules/projects/project-members.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectMember } from '../src/modules/projects/entities/project-member.entity';
import { createOpenApiDocument } from '../src/openapi';

// Offline metadata-only app: no database connection, .env, provider call, or listening socket.
// Register new public controllers here as the API grows, and test path coverage.
@Module({
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    ProjectsController,
    ProjectMembersController,
  ],
  providers: [
    { provide: HealthService, useValue: {} },
    { provide: AuthService, useValue: {} },
    {
      provide: SessionService,
      useValue: {
        getCookieName: () => 'aiws_session',
        getCookieOptions: () => ({}),
      },
    },
    { provide: UsersService, useValue: {} },
    { provide: ProjectsService, useValue: {} },
    { provide: ProjectMembersService, useValue: {} },
    { provide: AuditService, useValue: {} },
    { provide: getRepositoryToken(ProjectMember), useValue: {} },
  ],
})
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
