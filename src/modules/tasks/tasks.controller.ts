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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { RequireProjectRole } from '../../common/decorators/project-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-project.decorator';
import { User } from '../users/entities/user.entity';
import { ProjectMember, ProjectRole } from '../projects/entities/project-member.entity';

@ApiTags('Tasks')
@ApiCookieAuth()
@Controller('projects/:projectId/tasks')
@UseGuards(SessionAuthGuard, CsrfGuard, ProjectPolicyGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List project tasks with filters and pagination' })
  @ApiOkResponse({ description: 'Tasks returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListTasksQueryDto,
  ) {
    const [{ data, total }, projectKey] = await Promise.all([
      this.tasksService.list(projectId, query),
      this.tasksService.getProjectKey(projectId),
    ]);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      data: data.map((t) => TaskResponseDto.fromEntity(t, projectKey)),
      meta: { page, pageSize, total },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiCreatedResponse({ description: 'Task created' })
  async create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateTaskDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const task = await this.tasksService.create(projectId, user.id, dto, requestId);
    const projectKey = await this.tasksService.getProjectKey(projectId);
    return { data: TaskResponseDto.fromEntity(task, projectKey) };
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Get task details' })
  @ApiOkResponse({ description: 'Task returned' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  async getById(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    const task = await this.tasksService.getById(projectId, taskId);
    const projectKey = await this.tasksService.getProjectKey(projectId);
    return { data: TaskResponseDto.fromEntity(task, projectKey) };
  }

  @Patch(':taskId')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Update a task' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'Task updated' })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateTaskDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const task = await this.tasksService.update(projectId, taskId, user.id, dto, requestId);
    const projectKey = await this.tasksService.getProjectKey(projectId);
    return { data: TaskResponseDto.fromEntity(task, projectKey) };
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Soft-delete a task' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiNoContentResponse({ description: 'Task deleted' })
  async softDelete(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    await this.tasksService.softDelete(
      projectId,
      taskId,
      user.id,
      membership.accessRole,
      requestId,
    );
  }
}
