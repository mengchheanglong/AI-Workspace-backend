import 'multer';
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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
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
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ListDocumentsQueryDto } from './dto/list-documents-query.dto';
import { DocumentResponseDto } from './dto/document-response.dto';
import { DocumentRevisionResponseDto } from './dto/document-revision-response.dto';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { RequireProjectRole } from '../../common/decorators/project-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-project.decorator';
import { User } from '../users/entities/user.entity';
import { ProjectMember, ProjectRole } from '../projects/entities/project-member.entity';

@ApiTags('Documents')
@ApiCookieAuth()
@Controller('projects/:projectId/documents')
@UseGuards(SessionAuthGuard, CsrfGuard, ProjectPolicyGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List project documents with filters and pagination' })
  @ApiOkResponse({ description: 'Documents returned' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListDocumentsQueryDto,
  ) {
    const { data, total } = await this.documentsService.list(projectId, query);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    return {
      data: data.map((doc) => DocumentResponseDto.fromEntity(doc)),
      meta: { page, pageSize, total },
    };
  }

  @Post()
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a document (PDF, DOCX, TXT, MD; max 20 MiB)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string', example: 'Architecture Spec' },
        description: { type: 'string', example: 'High level system diagram and overview' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({ description: 'Document uploaded successfully', type: DocumentResponseDto })
  async upload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const document = await this.documentsService.upload(projectId, user.id, file, dto, requestId);
    return { data: DocumentResponseDto.fromEntity(document) };
  }

  @Get(':documentId')
  @ApiOperation({ summary: 'Get document details by ID' })
  @ApiOkResponse({ description: 'Document found', type: DocumentResponseDto })
  @ApiNotFoundResponse({ description: 'Document or project not found' })
  async getById(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    const document = await this.documentsService.getById(projectId, documentId);
    return { data: DocumentResponseDto.fromEntity(document) };
  }

  @Patch(':documentId')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Update document metadata with optimistic locking' })
  @ApiOkResponse({ description: 'Document updated successfully', type: DocumentResponseDto })
  @ApiHeader({ name: 'x-csrf-token', required: true })
  async update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateDocumentDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const document = await this.documentsService.update(
      projectId,
      documentId,
      user.id,
      dto,
      requestId,
    );
    return { data: DocumentResponseDto.fromEntity(document) };
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @ApiOperation({ summary: 'Soft-delete a document (Owner/Manager any, Contributor own)' })
  @ApiNoContentResponse({ description: 'Document soft-deleted' })
  @ApiHeader({ name: 'x-csrf-token', required: true })
  async softDelete(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ): Promise<void> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    await this.documentsService.softDelete(
      projectId,
      documentId,
      user.id,
      membership.accessRole,
      requestId,
    );
  }

  @Get(':documentId/download')
  @ApiOperation({ summary: 'Securely download document file' })
  @ApiOkResponse({ description: 'File stream returned' })
  @ApiNotFoundResponse({ description: 'Document or project not found' })
  async download(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const fileData = await this.documentsService.getDownloadStream(
      projectId,
      documentId,
      user.id,
      requestId,
    );

    const sanitized = fileData.originalFilename.replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', fileData.mimeType);
    res.setHeader('Content-Length', fileData.sizeBytes);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    fileData.stream.pipe(res);
  }

  @Post(':documentId/revisions')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload replacement file for document (creates new revision)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Document revision created successfully',
    type: DocumentResponseDto,
  })
  async createRevision(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const document = await this.documentsService.createRevision(
      projectId,
      documentId,
      user.id,
      file,
      requestId,
    );
    return { data: DocumentResponseDto.fromEntity(document) };
  }

  @Get(':documentId/revisions')
  @ApiOperation({ summary: 'List all previous and current revisions for a document' })
  @ApiOkResponse({ description: 'Revisions returned', type: [DocumentRevisionResponseDto] })
  async listRevisions(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    const revisions = await this.documentsService.listRevisions(projectId, documentId);
    return {
      data: revisions.map((rev) => DocumentRevisionResponseDto.fromEntity(rev)),
    };
  }
}
