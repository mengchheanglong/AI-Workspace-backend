import { ApiProperty } from '@nestjs/swagger';
import { ProjectMember, ProjectRole } from '../entities/project-member.entity';
import { ProfessionalRole } from '../../users/entities/user.entity';

export class MemberUserDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  id!: string;

  @ApiProperty({ example: 'alice@workspace.local' })
  email!: string;

  @ApiProperty({ example: 'Alice Smith' })
  displayName!: string;

  @ApiProperty({ enum: ProfessionalRole, example: ProfessionalRole.DEVELOPER })
  professionalRole!: ProfessionalRole;
}

export class MemberResponseDto {
  @ApiProperty({ example: 'c1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' })
  id!: string;

  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  projectId!: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  userId!: string;

  @ApiProperty({ enum: ProjectRole, example: ProjectRole.CONTRIBUTOR })
  accessRole!: ProjectRole;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  joinedAt!: string;

  @ApiProperty({ type: MemberUserDto })
  user!: MemberUserDto;

  static fromEntity(member: ProjectMember): MemberResponseDto {
    return {
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      accessRole: member.accessRole,
      joinedAt: member.joinedAt instanceof Date ? member.joinedAt.toISOString() : member.joinedAt,
      user: {
        id: member.user?.id ?? member.userId,
        email: member.user?.email ?? '',
        displayName: member.user?.displayName ?? '',
        professionalRole: member.user?.professionalRole ?? ProfessionalRole.DEVELOPER,
      },
    };
  }
}
