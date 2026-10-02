import { ApiProperty } from '@nestjs/swagger';
import { ProfessionalRole, SystemRole } from '../entities/user.entity';
import { InvitationStatus, WorkspaceInvitation } from '../entities/workspace-invitation.entity';

export class WorkspaceInvitationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: SystemRole })
  systemRole!: SystemRole;

  @ApiProperty({ enum: ProfessionalRole })
  professionalRole!: ProfessionalRole;

  @ApiProperty()
  token!: string;

  @ApiProperty()
  inviteUrl!: string;

  @ApiProperty({ enum: InvitationStatus })
  status!: InvitationStatus;

  @ApiProperty({ required: false, nullable: true })
  invitedBy!: { id: string; displayName: string } | null;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty()
  createdAt!: string;

  static fromEntity(entity: WorkspaceInvitation): WorkspaceInvitationResponseDto {
    const dto = new WorkspaceInvitationResponseDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.systemRole = entity.systemRole;
    dto.professionalRole = entity.professionalRole;
    dto.token = entity.token;
    dto.inviteUrl = `/invite/${entity.token}`;
    dto.status = entity.status;
    dto.invitedBy = entity.invitedBy
      ? { id: entity.invitedBy.id, displayName: entity.invitedBy.displayName }
      : null;
    dto.expiresAt =
      entity.expiresAt instanceof Date ? entity.expiresAt.toISOString() : entity.expiresAt;
    dto.createdAt =
      entity.createdAt instanceof Date ? entity.createdAt.toISOString() : entity.createdAt;
    return dto;
  }
}
