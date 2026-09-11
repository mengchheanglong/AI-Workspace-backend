import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateDocumentDto {
  @ApiProperty({ example: 1, description: 'Current version for optimistic locking' })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 'Updated Document Title', minLength: 1, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}
