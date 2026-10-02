import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { DecisionStatus } from '../entities/decision.entity';

export class ListDecisionsQueryDto {
  @ApiPropertyOptional({ enum: DecisionStatus })
  @IsOptional()
  @IsEnum(DecisionStatus)
  status?: DecisionStatus;

  @ApiPropertyOptional({ description: 'Filter by decision number (e.g. 1 for AIW-DEC-1)' })
  @IsOptional()
  @Transform(({ value }) =>
    value !== undefined && value !== '' ? parseInt(value as string, 10) : undefined,
  )
  @IsInt()
  @Min(1)
  number?: number;

  @ApiPropertyOptional({ example: 'postgresql', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({
    enum: ['number', 'title', 'status', 'decidedAt', 'createdAt', 'updatedAt'],
    default: 'number',
  })
  @IsOptional()
  @IsEnum(['number', 'title', 'status', 'decidedAt', 'createdAt', 'updatedAt'])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}
