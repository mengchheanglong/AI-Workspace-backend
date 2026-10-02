import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'A recognizable name for this token (e.g. "Claude Code CLI", "Cursor IDE")',
    example: 'Claude Code CLI',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Token validity in days. If omitted, the token will not expire until revoked.',
    example: 90,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
