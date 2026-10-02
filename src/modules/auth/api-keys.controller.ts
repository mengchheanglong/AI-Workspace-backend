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
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiKeyService } from './services/api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('API Keys & MCP')
@ApiCookieAuth()
@Controller('auth/api-keys')
@UseGuards(SessionAuthGuard, CsrfGuard)
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new Personal Access Token for coding agents (MCP)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiCreatedResponse({ description: 'API Key created. Raw token is returned only once.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async create(@CurrentUser() user: User, @Body() dto: CreateApiKeyDto) {
    const { apiKey, rawToken } = await this.apiKeyService.createKey(user.id, dto);
    return {
      data: ApiKeyResponseDto.fromEntity(apiKey, rawToken),
    };
  }

  @Get()
  @ApiOperation({ summary: 'List active Personal Access Tokens for the current user' })
  @ApiOkResponse({ description: 'List of active API keys' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async list(@CurrentUser() user: User) {
    const keys = await this.apiKeyService.listKeys(user.id);
    return {
      data: keys.map((k) => ApiKeyResponseDto.fromEntity(k)),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a Personal Access Token' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiOkResponse({ description: 'API Key revoked successfully' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async revoke(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    await this.apiKeyService.revokeKey(user.id, id);
    return {
      data: { status: 'ok' },
    };
  }
}
