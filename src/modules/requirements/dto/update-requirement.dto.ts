import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { RequirementStatus, Priority } from '../entities/requirement.entity';

export class UpdateRequirementDto {
  @ApiProperty({ example: 1, description: 'Current version for optimistic locking' })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 'Updated authentication flow', minLength: 1, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: 'Updated acceptance criteria' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  acceptanceCriteria?: string;

  @ApiPropertyOptional({ enum: RequirementStatus })
  @IsOptional()
  @IsEnum(RequirementStatus)
  status?: RequirementStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
