import {
  Body,
  Controller,
  Delete,
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
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequirementsService } from './requirements.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { ListRequirementsQueryDto } from './dto/list-requirements-query.dto';
import { RequirementResponseDto } from './dto/requirement-response.dto';
import { RequirementRevisionResponseDto } from './dto/requirement-revision-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { RequireProjectRole } from '../../common/decorators/project-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-project.decorator';
import { User } from '../users/entities/user.entity';
import { ProjectMember, ProjectRole } from '../projects/entities/project-member.entity';

@ApiTags('Requirements')
@ApiCookieAuth()
@Controller('projects/:projectId/requirements')
@UseGuards(SessionAuthGuard, CsrfGuard, ProjectPolicyGuard)
export class RequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Get()
  @ApiOperation({ summary: 'List project requirements with filters and pagination' })
  @ApiOkResponse({ description: 'Requirements returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListRequirementsQueryDto,
  ) {
    const [{ data, total }, projectKey] = await Promise.all([
      this.requirementsService.list(projectId, query),
      this.requirementsService.getProjectKey(projectId),
    ]);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      data: data.map((r) => RequirementResponseDto.fromEntity(r, projectKey)),
      meta: { page, pageSize, total },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Create a new requirement' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiCreatedResponse({ description: 'Requirement created' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateRequirementDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const requirement = await this.requirementsService.create(projectId, user.id, dto, requestId);
    const projectKey = await this.requirementsService.getProjectKey(projectId);
    return { data: RequirementResponseDto.fromEntity(requirement, projectKey) };
  }

  @Get(':requirementId')
  @ApiOperation({ summary: 'Get requirement details' })
  @ApiOkResponse({ description: 'Requirement returned' })
  @ApiNotFoundResponse({ description: 'Requirement not found' })
  async getById(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    const requirement = await this.requirementsService.getById(projectId, requirementId);
    const projectKey = await this.requirementsService.getProjectKey(projectId);
    return { data: RequirementResponseDto.fromEntity(requirement, projectKey) };
  }

  @Patch(':requirementId')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Update a requirement' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'Requirement updated' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateRequirementDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const requirement = await this.requirementsService.update(
      projectId,
      requirementId,
      user.id,
      dto,
      requestId,
    );
    const projectKey = await this.requirementsService.getProjectKey(projectId);
    return { data: RequirementResponseDto.fromEntity(requirement, projectKey) };
  }

  @Delete(':requirementId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Soft-delete a requirement' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiNoContentResponse({ description: 'Requirement deleted' })
  async softDelete(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    await this.requirementsService.softDelete(
      projectId,
      requirementId,
      user.id,
      membership.accessRole,
      requestId,
    );
  }

  @Get(':requirementId/revisions')
  @ApiOperation({ summary: 'List revision history for a requirement' })
  @ApiOkResponse({ description: 'Revisions returned' })
  async listRevisions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('requirementId', ParseUUIDPipe) requirementId: string,
  ) {
    const revisions = await this.requirementsService.listRevisions(projectId, requirementId);
    return { data: revisions.map(RequirementRevisionResponseDto.fromEntity) };
  }

  @Get(':requirementId/tasks')
  @ApiOperation({ summary: 'List tasks linked to this requirement (placeholder until P1-04)' })
  @ApiOkResponse({ description: 'Linked tasks returned' })
  async listLinkedTasks(
    @Param('projectId', ParseUUIDPipe) _projectId: string,
    @Param('requirementId', ParseUUIDPipe) _requirementId: string,
  ) {
    // Returns empty until Task entity exists in P1-04
    return { data: [], meta: { page: 1, pageSize: 20, total: 0 } };
  }
}
