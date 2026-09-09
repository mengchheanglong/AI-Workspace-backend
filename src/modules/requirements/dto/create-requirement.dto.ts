import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Priority } from '../entities/requirement.entity';

export class CreateRequirementDto {
  @ApiProperty({ example: 'User authentication flow', minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ example: 'Implement OAuth2 based authentication' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: 'Users can log in with email and password' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  acceptanceCriteria?: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.MEDIUM })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
