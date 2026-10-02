import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKey } from '../entities/api-key.entity';

export class ApiKeyResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'Claude Code CLI' })
  name!: string;

  @ApiProperty({ example: 'aiw_pat_a1b2' })
  keyPrefix!: string;

  @ApiPropertyOptional({ example: '2026-10-02T10:00:00Z', nullable: true })
  lastUsedAt!: Date | null;

  @ApiPropertyOptional({ example: '2027-01-01T10:00:00Z', nullable: true })
  expiresAt!: Date | null;

  @ApiProperty({ example: '2026-10-02T08:00:00Z' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Raw secret token. Only returned once upon creation. Store securely.',
    example: 'aiw_pat_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  })
  rawToken?: string;

  static fromEntity(entity: ApiKey, rawToken?: string): ApiKeyResponseDto {
    const dto = new ApiKeyResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.keyPrefix = entity.keyPrefix;
    dto.lastUsedAt = entity.lastUsedAt;
    dto.expiresAt = entity.expiresAt;
    dto.createdAt = entity.createdAt;
    if (rawToken) {
      dto.rawToken = rawToken;
    }
    return dto;
  }
}
