import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    example: 'AIW',
    description: 'Unique project key identifier (2-10 uppercase alphanumeric characters)',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{2,10}$/, {
    message: 'Project key must consist of 2 to 10 uppercase letters or numbers.',
  })
  key!: string;

  @ApiProperty({ example: 'AI Workspace Core', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Central backend workspace for multi-modal project management' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
