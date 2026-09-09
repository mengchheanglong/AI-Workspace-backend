import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DecisionRevision } from '../entities/decision-revision.entity';

export class DecisionRevisionResponseDto {
  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  id!: string;

  @ApiProperty({ example: 'f87a8f89-8d7b-4029-9fa9-6f9ec67bc9e3' })
  decisionId!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: 'Use PostgreSQL' })
  title!: string;

  @ApiProperty({ example: 'We will use PostgreSQL' })
  decisionText!: string;

  @ApiPropertyOptional({ nullable: true })
  rationale!: string | null;

  @ApiProperty({ example: 'PROPOSED' })
  status!: string;

  @ApiProperty()
  changedBy!: string;

  @ApiProperty({ example: '2026-09-09T10:00:00.000Z' })
  createdAt!: string;

  static fromEntity(rev: DecisionRevision): DecisionRevisionResponseDto {
    return {
      id: rev.id,
      decisionId: rev.decisionId,
      version: rev.version,
      title: rev.title,
      decisionText: rev.decisionText,
      rationale: rev.rationale,
      status: rev.status,
      changedBy: rev.changedBy,
      createdAt: rev.createdAt instanceof Date ? rev.createdAt.toISOString() : rev.createdAt,
    };
  }
}
