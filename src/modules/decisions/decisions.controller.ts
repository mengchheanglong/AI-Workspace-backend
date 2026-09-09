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
import { DecisionsService } from './decisions.service';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { ListDecisionsQueryDto } from './dto/list-decisions-query.dto';
import { DecisionResponseDto } from './dto/decision-response.dto';
import { DecisionRevisionResponseDto } from './dto/decision-revision-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { RequireProjectRole } from '../../common/decorators/project-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-project.decorator';
import { User } from '../users/entities/user.entity';
import { ProjectMember, ProjectRole } from '../projects/entities/project-member.entity';

@ApiTags('Decisions')
@ApiCookieAuth()
@Controller('projects/:projectId/decisions')
@UseGuards(SessionAuthGuard, CsrfGuard, ProjectPolicyGuard)
export class DecisionsController {
  constructor(private readonly decisionsService: DecisionsService) {}

  @Get()
  @ApiOperation({ summary: 'List project decisions with filters and pagination' })
  @ApiOkResponse({ description: 'Decisions returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListDecisionsQueryDto,
  ) {
    const [{ data, total }, projectKey] = await Promise.all([
      this.decisionsService.list(projectId, query),
      this.decisionsService.getProjectKey(projectId),
    ]);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      data: data.map((d) => DecisionResponseDto.fromEntity(d, projectKey)),
      meta: { page, pageSize, total },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Create a new decision' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiCreatedResponse({ description: 'Decision created' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateDecisionDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const decision = await this.decisionsService.create(projectId, user.id, dto, requestId);
    const projectKey = await this.decisionsService.getProjectKey(projectId);
    return { data: DecisionResponseDto.fromEntity(decision, projectKey) };
  }

  @Get(':decisionId')
  @ApiOperation({ summary: 'Get decision details' })
  @ApiOkResponse({ description: 'Decision returned' })
  @ApiNotFoundResponse({ description: 'Decision not found' })
  async getById(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
  ) {
    const decision = await this.decisionsService.getById(projectId, decisionId);
    const projectKey = await this.decisionsService.getProjectKey(projectId);
    return { data: DecisionResponseDto.fromEntity(decision, projectKey) };
  }

  @Patch(':decisionId')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Update a decision' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'Decision updated' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateDecisionDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const decision = await this.decisionsService.update(
      projectId,
      decisionId,
      user.id,
      dto,
      requestId,
    );
    const projectKey = await this.decisionsService.getProjectKey(projectId);
    return { data: DecisionResponseDto.fromEntity(decision, projectKey) };
  }

  @Delete(':decisionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Soft-delete a decision' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiNoContentResponse({ description: 'Decision deleted' })
  async softDelete(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    await this.decisionsService.softDelete(
      projectId,
      decisionId,
      user.id,
      membership.accessRole,
      requestId,
    );
  }

  @Get(':decisionId/revisions')
  @ApiOperation({ summary: 'List revision history for a decision' })
  @ApiOkResponse({ description: 'Revisions returned' })
  async listRevisions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('decisionId', ParseUUIDPipe) decisionId: string,
  ) {
    const revisions = await this.decisionsService.listRevisions(projectId, decisionId);
    return { data: revisions.map(DecisionRevisionResponseDto.fromEntity) };
  }
}
