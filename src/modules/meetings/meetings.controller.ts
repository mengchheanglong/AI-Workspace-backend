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
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { ListMeetingsQueryDto } from './dto/list-meetings-query.dto';
import { MeetingResponseDto } from './dto/meeting-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { RequireProjectRole } from '../../common/decorators/project-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-project.decorator';
import { User } from '../users/entities/user.entity';
import { ProjectMember, ProjectRole } from '../projects/entities/project-member.entity';

@ApiTags('Meetings')
@ApiCookieAuth()
@Controller('projects/:projectId/meetings')
@UseGuards(SessionAuthGuard, CsrfGuard, ProjectPolicyGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @ApiOperation({ summary: 'List project meetings with filters and pagination' })
  @ApiOkResponse({ description: 'Meetings returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListMeetingsQueryDto,
  ) {
    const { data, total } = await this.meetingsService.list(projectId, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      data: data.map((m) => MeetingResponseDto.fromEntity(m)),
      meta: { page, pageSize, total },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Create a new meeting' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiCreatedResponse({ description: 'Meeting created' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateMeetingDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const meeting = await this.meetingsService.create(projectId, user.id, dto, requestId);
    return { data: MeetingResponseDto.fromEntity(meeting) };
  }

  @Get(':meetingId')
  @ApiOperation({ summary: 'Get meeting details' })
  @ApiOkResponse({ description: 'Meeting returned' })
  @ApiNotFoundResponse({ description: 'Meeting not found' })
  async getById(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    const meeting = await this.meetingsService.getById(projectId, meetingId);
    return { data: MeetingResponseDto.fromEntity(meeting) };
  }

  @Patch(':meetingId')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Update a meeting' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'Meeting updated' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateMeetingDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const meeting = await this.meetingsService.update(
      projectId,
      meetingId,
      user.id,
      dto,
      requestId,
    );
    return { data: MeetingResponseDto.fromEntity(meeting) };
  }

  @Delete(':meetingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Soft-delete a meeting' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiNoContentResponse({ description: 'Meeting deleted' })
  async softDelete(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    await this.meetingsService.softDelete(
      projectId,
      meetingId,
      user.id,
      membership.accessRole,
      requestId,
    );
  }
}
