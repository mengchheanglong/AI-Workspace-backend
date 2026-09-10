import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateMeetingDto {
  @ApiProperty({ example: 1, description: 'Current version for optimistic locking' })
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ example: 'Updated Sprint Planning', minLength: 1, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ example: '2026-09-15T09:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-09-15T10:30:00.000Z' })
  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @ApiPropertyOptional({ example: 'Updated agenda', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  agenda?: string | null;

  @ApiPropertyOptional({ example: 'Updated notes', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string | null;

  @ApiPropertyOptional({ example: 'Updated transcript...', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  transcriptText?: string | null;

  @ApiPropertyOptional({ example: 'Approved summary of the meeting', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'Updated list of project member user IDs attending',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attendeeUserIds?: string[];
}
