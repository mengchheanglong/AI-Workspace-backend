import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ProjectStatus } from './entities/project.entity';
import { ProjectRole } from './entities/project-member.entity';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { AllowArchived, RequireProjectRole } from '../../common/decorators/project-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-project.decorator';
import { User } from '../users/entities/user.entity';
import { ProjectMember } from './entities/project-member.entity';
import { AuditService } from '../audit/audit.service';

@ApiTags('Projects')
@ApiCookieAuth()
@Controller('projects')
@UseGuards(SessionAuthGuard, CsrfGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List projects for current authenticated user' })
  @ApiQuery({ name: 'status', enum: ProjectStatus, required: false })
  @ApiOkResponse({ description: 'User projects returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async listProjects(@CurrentUser() user: User, @Query('status') status?: ProjectStatus) {
    const projects = await this.projectsService.listUserProjects(user.id, status);
    return {
      data: projects.map(({ project, accessRole }) =>
        ProjectResponseDto.fromEntity(project, accessRole),
      ),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project workspace' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'Project created' })
  async createProject(
    @CurrentUser() user: User,
    @Body() dto: CreateProjectDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const { project, accessRole } = await this.projectsService.createProject(
      user.id,
      dto,
      requestId,
    );
    return {
      data: ProjectResponseDto.fromEntity(project, accessRole),
    };
  }

  @Get(':projectId')
  @UseGuards(ProjectPolicyGuard)
  @ApiOperation({ summary: 'Get project workspace details by ID' })
  @ApiNotFoundResponse({ description: 'Project not found or inaccessible' })
  async getProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
  ) {
    const { project, accessRole } = await this.projectsService.getProject(projectId, user.id);
    return {
      data: ProjectResponseDto.fromEntity(project, accessRole),
    };
  }

  @Patch(':projectId')
  @UseGuards(ProjectPolicyGuard)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Update project settings (Owner or Manager)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  async updateProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const updated = await this.projectsService.updateProject(projectId, user.id, dto, requestId);
    return {
      data: ProjectResponseDto.fromEntity(updated, membership.accessRole),
    };
  }

  @Post(':projectId/archive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectPolicyGuard)
  @RequireProjectRole(ProjectRole.OWNER)
  @ApiOperation({ summary: 'Archive project workspace (Owner only)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  async archiveProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const archived = await this.projectsService.archiveProject(projectId, user.id, requestId);
    return {
      data: ProjectResponseDto.fromEntity(archived, membership.accessRole),
    };
  }

  @Post(':projectId/unarchive')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ProjectPolicyGuard)
  @RequireProjectRole(ProjectRole.OWNER)
  @AllowArchived()
  @ApiOperation({ summary: 'Unarchive project workspace (Owner only)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  async unarchiveProject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const unarchived = await this.projectsService.unarchiveProject(projectId, user.id, requestId);
    return {
      data: ProjectResponseDto.fromEntity(unarchived, membership.accessRole),
    };
  }

  @Get(':projectId/audit')
  @UseGuards(ProjectPolicyGuard)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'View project audit log trail (Owner or Manager)' })
  async getAuditLogs(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50));
    const { logs, total } = await this.auditService.listForProject(projectId, p, ps);
    return {
      data: logs,
      meta: { page: p, pageSize: ps, total },
    };
  }
}
