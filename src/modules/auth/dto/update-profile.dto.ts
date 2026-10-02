import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProfessionalRole } from '../../users/entities/user.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Alice Developer' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ enum: ProfessionalRole })
  @IsOptional()
  @IsEnum(ProfessionalRole)
  professionalRole?: ProfessionalRole;
}
