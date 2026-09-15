import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ListActivityQueryDto } from './dto/dashboard.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Dashboard')
@ApiCookieAuth()
@Controller('projects/:projectId')
@UseGuards(SessionAuthGuard, CsrfGuard, ProjectPolicyGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get aggregated project dashboard metrics and recent activity' })
  @ApiQuery({
    name: 'timezone',
    required: false,
    description: 'Display timezone (defaults to Asia/Bangkok)',
    example: 'Asia/Bangkok',
  })
  @ApiOkResponse({ description: 'Dashboard metrics returned successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Project not found or inaccessible' })
  async getDashboard(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: User,
    @Query('timezone') timezone?: string,
  ) {
    const data = await this.dashboardService.getDashboard(
      projectId,
      user.id,
      timezone || 'Asia/Bangkok',
    );
    return { data };
  }

  @Get('activity')
  @ApiOperation({ summary: 'Get paginated project activity stream' })
  @ApiOkResponse({ description: 'Activity stream returned successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Project not found or inaccessible' })
  async getActivity(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListActivityQueryDto,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { data, total } = await this.dashboardService.getActivity(projectId, page, pageSize);
    return {
      data,
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }
}
