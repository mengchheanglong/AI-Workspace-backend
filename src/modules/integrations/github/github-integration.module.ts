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
import { GitHubConnection, GitHubIssue, GitHubPullRequest, GitHubRepoFile } from './entities';
import { GitHubIntegrationController } from './github-integration.controller';
import { GitHubIntegrationService } from './github-integration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GitHubConnection,
      GitHubIssue,
      GitHubPullRequest,
      GitHubRepoFile,
      Project,
    ]),
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
        const useMock = configService.get<string>('GITHUB_USE_MOCK') === 'true';
        return process.env.NODE_ENV === 'test' && useMock ? mockClient : httpClient;
      },
      inject: [ConfigService, HttpGitHubClientService, MockGitHubClientService],
    },
  ],
  exports: [GitHubIntegrationService, GITHUB_CLIENT],
})
export class GitHubIntegrationModule {}
