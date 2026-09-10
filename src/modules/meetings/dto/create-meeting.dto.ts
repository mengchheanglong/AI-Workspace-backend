import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMeetingDto {
  @ApiProperty({ example: 'Sprint Planning', minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiProperty({ example: '2026-09-15T09:00:00.000Z' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ example: '2026-09-15T10:00:00.000Z' })
  @IsISO8601()
  endsAt!: string;

  @ApiPropertyOptional({ example: 'Review backlog and estimate tasks' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  agenda?: string;

  @ApiPropertyOptional({ example: 'Discussed architecture and timelines' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  notes?: string;

  @ApiPropertyOptional({ example: 'Speaker 1: Hello everyone...' })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  transcriptText?: string;

  @ApiPropertyOptional({ type: [String], description: 'List of project member user IDs attending' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  attendeeUserIds?: string[];
}
