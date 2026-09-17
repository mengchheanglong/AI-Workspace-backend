import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../audit/audit.module';
import { IngestionModule } from '../../ingestion/ingestion.module';
import { Project } from '../../projects/entities/project.entity';
import { ProjectsModule } from '../../projects/projects.module';
import { GITHUB_CLIENT } from './client/github-client.interface';
import { HttpGitHubClientService } from './client/http-github-client.service';
import { MockGitHubClientService } from './client/mock-github-client.service';
import { GitHubConnection } from './entities/github-connection.entity';
import { GitHubIssue } from './entities/github-issue.entity';
import { GitHubIntegrationController } from './github-integration.controller';
import { GitHubIntegrationService } from './github-integration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GitHubConnection, GitHubIssue, Project]),
    ConfigModule,
    AuditModule,
    IngestionModule,
    ProjectsModule,
  ],
  controllers: [GitHubIntegrationController],
  providers: [
    GitHubIntegrationService,
    HttpGitHubClientService,
    MockGitHubClientService,
    {
      provide: GITHUB_CLIENT,
      useFactory: (
        configService: ConfigService,
        httpClient: HttpGitHubClientService,
        mockClient: MockGitHubClientService,
      ) => {
        const enabled = configService.get<boolean>('GITHUB_ENABLED') ?? false;
        const useMock = configService.get<string>('GITHUB_USE_MOCK') === 'true';
        if (enabled && !useMock) {
          return httpClient;
        }
        return mockClient;
      },
      inject: [ConfigService, HttpGitHubClientService, MockGitHubClientService],
    },
  ],
  exports: [GitHubIntegrationService, GITHUB_CLIENT],
})
export class GitHubIntegrationModule {}
