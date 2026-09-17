import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { ProjectPolicyGuard } from '../../../common/guards/project-policy.guard';
import { SessionAuthGuard } from '../../../common/guards/session-auth.guard';
import { ProjectRole } from '../../projects/entities/project-member.entity';
import { ConnectGitHubDto } from './dto/connect-github.dto';
import {
  GitHubConnectionResponseDto,
  GitHubIssueResponseDto,
  SyncGitHubResponseDto,
} from './dto/github-responses.dto';
import { ListGitHubIssuesQueryDto } from './dto/list-github-issues-query.dto';
import { GitHubIntegrationService } from './github-integration.service';

@ApiTags('GitHub Integration')
@Controller('projects/:projectId/integrations/github')
@UseGuards(SessionAuthGuard, ProjectPolicyGuard)
export class GitHubIntegrationController {
  constructor(private readonly githubService: GitHubIntegrationService) {}

  @Get()
  @RequireProjectRole(
    ProjectRole.OWNER,
    ProjectRole.MANAGER,
    ProjectRole.CONTRIBUTOR,
    ProjectRole.VIEWER,
  )
  @ApiOperation({ summary: 'Get current GitHub connection for project' })
  @ApiResponse({ status: 200, type: GitHubConnectionResponseDto })
  async getConnection(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<GitHubConnectionResponseDto | null> {
    return this.githubService.getConnection(projectId);
  }

  @Post('connect')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Connect repository and trigger initial sync' })
  @ApiResponse({ status: 200, type: GitHubConnectionResponseDto })
  async connect(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: ConnectGitHubDto,
  ): Promise<GitHubConnectionResponseDto> {
    return this.githubService.connectRepository(projectId, actorId, dto);
  }

  @Post('sync')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Manually trigger issue sync from GitHub' })
  @ApiResponse({ status: 200, type: SyncGitHubResponseDto })
  async sync(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') actorId: string,
    @Body('accessToken') accessToken?: string,
  ): Promise<SyncGitHubResponseDto> {
    return this.githubService.syncIssues(projectId, actorId, accessToken);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Disconnect repository and deactivate knowledge sources' })
  @ApiResponse({ status: 204, description: 'Disconnected successfully' })
  async disconnect(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser('id') actorId: string,
  ): Promise<void> {
    await this.githubService.disconnect(projectId, actorId);
  }

  @Get('issues')
  @RequireProjectRole(
    ProjectRole.OWNER,
    ProjectRole.MANAGER,
    ProjectRole.CONTRIBUTOR,
    ProjectRole.VIEWER,
  )
  @ApiOperation({ summary: 'List synced GitHub issues for project' })
  @ApiResponse({ status: 200, type: [GitHubIssueResponseDto] })
  async listIssues(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListGitHubIssuesQueryDto,
  ): Promise<{ items: GitHubIssueResponseDto[]; total: number; page: number; limit: number }> {
    return this.githubService.listIssues(projectId, query);
  }
}
