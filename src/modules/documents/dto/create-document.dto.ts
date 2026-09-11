import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiPropertyOptional({ example: 'Architecture Overview', minLength: 1, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: 'Initial architectural specification document' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
