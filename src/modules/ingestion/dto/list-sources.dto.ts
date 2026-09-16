import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KnowledgeSourceStatus, KnowledgeSourceType } from '../entities/knowledge-source.entity';

export class ListKnowledgeSourcesDto {
  @ApiPropertyOptional({ enum: KnowledgeSourceType })
  @IsOptional()
  @IsEnum(KnowledgeSourceType)
  sourceType?: KnowledgeSourceType;

  @ApiPropertyOptional({ enum: KnowledgeSourceStatus })
  @IsOptional()
  @IsEnum(KnowledgeSourceStatus)
  status?: KnowledgeSourceStatus;

  @ApiPropertyOptional({ description: 'Search term for title' })
  @IsOptional()
  @IsString()
  search?: string;
}
