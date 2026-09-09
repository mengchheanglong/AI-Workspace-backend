import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { ProjectRole } from '../entities/project-member.entity';

export class AddMemberDto {
  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @IsUUID('4')
  userId!: string;

  @ApiProperty({
    enum: [ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR, ProjectRole.VIEWER],
    example: ProjectRole.CONTRIBUTOR,
  })
  @IsEnum(ProjectRole)
  accessRole!: ProjectRole;
}
