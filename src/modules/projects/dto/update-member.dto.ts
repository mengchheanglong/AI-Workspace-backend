import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectRole } from '../entities/project-member.entity';

export class UpdateMemberDto {
  @ApiProperty({
    enum: [ProjectRole.MANAGER, ProjectRole.CONTRIBUTOR, ProjectRole.VIEWER],
    example: ProjectRole.MANAGER,
  })
  @IsEnum(ProjectRole)
  accessRole!: ProjectRole;
}
