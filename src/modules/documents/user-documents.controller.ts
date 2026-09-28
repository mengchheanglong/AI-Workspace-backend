import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Documents')
@ApiCookieAuth()
@Controller('documents')
@UseGuards(SessionAuthGuard, CsrfGuard)
export class UserDocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents across all active projects for the current user' })
  @ApiOkResponse({ description: 'Documents returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  async listUserDocuments(@CurrentUser() user: User, @Query() query: ListDocumentsQueryDto) {
    const { data, total } = await this.documentsService.listAllUserDocuments(user.id, query);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 100));
    return {
      data: data.map((doc) => DocumentResponseDto.fromEntity(doc)),
      meta: { page, pageSize, total },
    };
  }
}
