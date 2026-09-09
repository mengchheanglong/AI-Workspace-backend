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
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { SystemRolesGuard } from '../../common/guards/system-roles.guard';
import { SystemRoles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SystemRole, User } from './entities/user.entity';

@ApiTags('Users')
@ApiCookieAuth()
@Controller('users')
@UseGuards(SessionAuthGuard, CsrfGuard, SystemRolesGuard)
@SystemRoles(SystemRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users with pagination and search (Admin only)' })
  @ApiOkResponse({ description: 'Paginated user list' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Admin role required' })
  async findAll(@Query() query: UsersQueryDto) {
    const { users, total } = await this.usersService.findAll(query);
    return {
      data: users.map(UserResponseDto.fromEntity),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user account (Admin only)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'User created' })
  async create(@Body() dto: CreateUserDto) {
    const { user, temporaryPassword } = await this.usersService.create(dto);
    return {
      data: {
        ...UserResponseDto.fromEntity(user),
        ...(temporaryPassword ? { temporaryPassword } : {}),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID (Admin only)' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return { data: null };
    }
    return { data: UserResponseDto.fromEntity(user) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user account or deactivate (Admin only)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiNotFoundResponse({ description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: User,
  ) {
    const updated = await this.usersService.update(id, dto, actor.id);
    return { data: UserResponseDto.fromEntity(updated) };
  }
}
