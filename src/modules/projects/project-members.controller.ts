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
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ProjectMembersService } from './project-members.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { MemberResponseDto, MemberUserDto } from './dto/member-response.dto';
import { ProjectRole, ProjectMember } from './entities/project-member.entity';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { ProjectPolicyGuard } from '../../common/guards/project-policy.guard';
import { RequireProjectRole } from '../../common/decorators/project-role.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentMembership } from '../../common/decorators/current-project.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Project Members')
@ApiCookieAuth()
@Controller('projects/:projectId')
@UseGuards(SessionAuthGuard, CsrfGuard, ProjectPolicyGuard)
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get('members')
  @ApiOperation({ summary: 'List active members of a project workspace' })
  @ApiOkResponse({ description: 'Project members returned' })
  async listMembers(@Param('projectId', ParseUUIDPipe) projectId: string) {
    const members = await this.membersService.listMembers(projectId);
    return {
      data: members.map(MemberResponseDto.fromEntity),
    };
  }

  @Post('members')
  @HttpCode(HttpStatus.CREATED)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Add a user as project member (Owner or Manager)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  async addMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() actor: User,
    @CurrentMembership() membership: ProjectMember,
    @Body() dto: AddMemberDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const member = await this.membersService.addMember(
      projectId,
      actor.id,
      membership.accessRole,
      dto,
      requestId,
    );
    return {
      data: MemberResponseDto.fromEntity(member),
    };
  }

  @Patch('members/:userId')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Update member access role in project' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  async updateMemberRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() actor: User,
    @CurrentMembership() membership: ProjectMember,
    @Body() dto: UpdateMemberDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const updated = await this.membersService.updateRole(
      projectId,
      actor.id,
      membership.accessRole,
      targetUserId,
      dto,
      requestId,
    );
    return {
      data: MemberResponseDto.fromEntity(updated),
    };
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Remove a member from project (soft removal)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  @ApiNoContentResponse({ description: 'Member removed' })
  async removeMember(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() actor: User,
    @CurrentMembership() membership: ProjectMember,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    await this.membersService.removeMember(
      projectId,
      actor.id,
      membership.accessRole,
      targetUserId,
      requestId,
    );
  }

  @Post('ownership-transfer')
  @HttpCode(HttpStatus.OK)
  @RequireProjectRole(ProjectRole.OWNER)
  @ApiOperation({ summary: 'Transfer project ownership to another active member (Owner only)' })
  @ApiHeader({ name: 'x-csrf-token', description: 'CSRF token', required: true })
  async transferOwnership(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() actor: User,
    @Body() dto: TransferOwnershipDto,
    @Req() req: Request,
  ) {
    const requestId = req.headers['x-request-id'] as string | undefined;
    const result = await this.membersService.transferOwnership(projectId, actor.id, dto, requestId);
    return {
      data: {
        newOwner: MemberResponseDto.fromEntity(result.newOwner),
        previousOwner: MemberResponseDto.fromEntity(result.previousOwner),
      },
    };
  }

  @Get('member-candidates')
  @RequireProjectRole(ProjectRole.OWNER, ProjectRole.MANAGER)
  @ApiOperation({ summary: 'Search users who are eligible to be invited to this project' })
  async searchCandidates(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('search') search?: string,
  ) {
    const users = await this.membersService.searchCandidates(projectId, search);
    return {
      data: users.map((u): MemberUserDto => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        professionalRole: u.professionalRole,
      })),
    };
  }
}
