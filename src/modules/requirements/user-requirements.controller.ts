import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RequirementsService } from './requirements.service';
import { ListRequirementsQueryDto } from './dto/list-requirements-query.dto';
import { RequirementResponseDto } from './dto/requirement-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Requirements')
@ApiCookieAuth()
@Controller('requirements')
@UseGuards(SessionAuthGuard, CsrfGuard)
export class UserRequirementsController {
  constructor(private readonly requirementsService: RequirementsService) {}

  @Get()
  @ApiOperation({ summary: 'List requirements across all active projects for the current user' })
  @ApiOkResponse({ description: 'Requirements returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async listUserRequirements(@CurrentUser() user: User, @Query() query: ListRequirementsQueryDto) {
    const { data, total } = await this.requirementsService.listAllUserRequirements(user.id, query);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    return {
      data: data.map((r) => RequirementResponseDto.fromEntity(r, r.project?.key || 'REQ')),
      meta: { page, pageSize, total },
    };
  }
}
