import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequirementRevision } from '../entities/requirement-revision.entity';

export class RequirementRevisionResponseDto {
  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  id!: string;

  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  requirementId!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: 'User authentication flow' })
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  acceptanceCriteria!: string | null;

  @ApiProperty({ example: 'DRAFT' })
  status!: string;

  @ApiProperty({ example: 'MEDIUM' })
  priority!: string;

  @ApiProperty({ example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  changedBy!: string;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  createdAt!: string;

  static fromEntity(rev: RequirementRevision): RequirementRevisionResponseDto {
    return {
      id: rev.id,
      requirementId: rev.requirementId,
      version: rev.version,
      title: rev.title,
      description: rev.description,
      acceptanceCriteria: rev.acceptanceCriteria,
      status: rev.status,
      priority: rev.priority,
      changedBy: rev.changedBy,
      createdAt: rev.createdAt instanceof Date ? rev.createdAt.toISOString() : rev.createdAt,
    };
  }
}
