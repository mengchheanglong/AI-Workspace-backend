import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Requirement, RequirementStatus, Priority } from '../entities/requirement.entity';

export class RequirementResponseDto {
  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  id!: string;

  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  projectId!: string;

  @ApiProperty({ example: 12 })
  number!: number;

  @ApiProperty({ example: 'AIW-REQ-12' })
  displayKey!: string;

  @ApiProperty({ example: 'User authentication flow' })
  title!: string;

  @ApiPropertyOptional({ example: 'OAuth2 based auth', nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ example: 'Users can log in', nullable: true })
  acceptanceCriteria!: string | null;

  @ApiProperty({ enum: RequirementStatus, example: RequirementStatus.DRAFT })
  status!: RequirementStatus;

  @ApiProperty({ enum: Priority, example: Priority.MEDIUM })
  priority!: Priority;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  createdBy!: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  updatedBy!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(requirement: Requirement, projectKey: string): RequirementResponseDto {
    return {
      id: requirement.id,
      projectId: requirement.projectId,
      number: requirement.number,
      displayKey: `${projectKey}-REQ-${requirement.number}`,
      title: requirement.title,
      description: requirement.description,
      acceptanceCriteria: requirement.acceptanceCriteria,
      status: requirement.status,
      priority: requirement.priority,
      createdBy: requirement.createdBy,
      updatedBy: requirement.updatedBy,
      version: requirement.version,
      createdAt:
        requirement.createdAt instanceof Date
          ? requirement.createdAt.toISOString()
          : requirement.createdAt,
      updatedAt:
        requirement.updatedAt instanceof Date
          ? requirement.updatedAt.toISOString()
          : requirement.updatedAt,
    };
  }
}
