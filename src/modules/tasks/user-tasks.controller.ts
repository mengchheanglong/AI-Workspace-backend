import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Tasks')
@ApiCookieAuth()
@Controller('tasks')
@UseGuards(SessionAuthGuard, CsrfGuard)
export class UserTasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List tasks across all active projects for the current user' })
  @ApiOkResponse({ description: 'Tasks returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async listUserTasks(@CurrentUser() user: User, @Query() query: ListTasksQueryDto) {
    const { data, total } = await this.tasksService.listAllUserTasks(user.id, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    return {
      data: data.map((t) => TaskResponseDto.fromEntity(t, t.project?.key || 'TASK')),
      meta: { page, pageSize, total },
    };
  }
}
